package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	appcoaching "github.com/hamid-karimi/coachin/apps/api/internal/app/coaching"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/coaching"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestCoachingOnPostgres(t *testing.T) {
	urls := migratedDB(t)
	ctx := context.Background()
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	pool, err := store.Open(ctx, urls.App)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	now := time.Now()
	svc := appcoaching.NewService(store.NewCoachingStore(pool), func() time.Time { return now })
	coach := seedUser(t, owner, "coach@example.com")
	ada := seedUser(t, owner, "ada@example.com")
	other := seedUser(t, owner, "other-coach@example.com")
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`UPDATE profiles SET role = 'coach' WHERE id = ANY($1)`, []any{coach, other})
	exec(`UPDATE profiles SET full_name = 'Ada Lovelace', nutrition_sharing_enabled = true WHERE id = $1`, ada)
	var sportID int64
	_ = owner.QueryRow(ctx, `SELECT id FROM sport_types ORDER BY id LIMIT 1`).Scan(&sportID)

	// Roles gate the hub and codes.
	var appErr *apperr.Error
	if _, err := svc.Hub(ctx, ada); !errors.As(err, &appErr) || appErr.Kind != apperr.Forbidden {
		t.Fatalf("trainee opened the hub: %v", err)
	}
	code, err := svc.GenerateInviteCode(ctx, coach, sportID)
	if err != nil || len(code) < 10 {
		t.Fatalf("code = %q, %v", code, err)
	}
	again, _ := svc.GenerateInviteCode(ctx, coach, sportID)
	if again == code {
		t.Error("regenerating kept the old code")
	}

	// Join: old code is dead, new one works, second join is a no-op.
	if _, err := svc.Join(ctx, ada, code); !errors.As(err, &appErr) || appErr.Message != "Invalid invite code" {
		t.Fatalf("stale code: %v", err)
	}
	joined, err := svc.Join(ctx, ada, " "+again+" ")
	if err != nil || joined.Message != "Coach added successfully." {
		t.Fatalf("join = %+v, %v", joined, err)
	}
	if joined, _ := svc.Join(ctx, ada, again); joined.Status != "info" {
		t.Errorf("rejoin = %+v", joined)
	}
	if _, err := svc.Join(ctx, coach, again); !errors.As(err, &appErr) {
		t.Errorf("a coach-only role joined: %v", err)
	}

	// Ada's week: a routine on Monday + today, a log on Monday.
	monday := dates.MondayOf(now)
	exec(`INSERT INTO schedules (user_id, day_of_week) VALUES ($1, 1), ($1, $2)`, ada, int(now.Weekday()))
	exec(`INSERT INTO logs (user_id, sport_type_id, date, status) VALUES ($1, $2, $3, 'completed')`, ada, sportID, dates.ToYMD(monday))
	exec(`INSERT INTO xp_transactions (user_id, amount, reason) VALUES ($1, 60, 'workout_log:1:x')`, ada)
	var planID any
	_ = owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, plan_kind, weeks_total, status, summary, created_at) VALUES ($1, 'race', 8, 'active', '', now()) RETURNING id`, ada).Scan(&planID)
	exec(`INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title, is_completed) VALUES ($1, 1, 1, 'run', 'Easy', true), ($1, 1, 3, 'run', 'Tempo', false)`, planID)

	hub, err := svc.Hub(ctx, coach)
	if err != nil || len(hub.Trainees) != 1 || len(hub.InviteCodes) != 1 || hub.InviteCodes[0].Code != again {
		t.Fatalf("hub = %+v, %v", hub, err)
	}
	tr := hub.Trainees[0]
	if tr.ID != ada || *tr.FullName != "Ada Lovelace" || !tr.NutritionShared || tr.WeeklyXP != 60 || tr.DoneCount != 1 || tr.Sport == nil {
		t.Fatalf("trainee = %+v", tr)
	}
	if tr.Week[0].State != coaching.Done || len(tr.Plans) != 1 || tr.Plans[0].AdherencePct != 50 {
		t.Fatalf("week = %+v plans = %+v", tr.Week, tr.Plans)
	}
	sum, _ := svc.Summary(ctx, coach)
	if sum.TraineeCount != 1 || sum.TrainedThisWeek != 1 {
		t.Errorf("summary = %+v", sum)
	}

	// Another coach sees no one; can't assign to Ada.
	if hub, _ := svc.Hub(ctx, other); len(hub.Trainees) != 0 {
		t.Fatalf("other coach sees %d trainees", len(hub.Trainees))
	}
	if _, err := svc.AssignWeeklyPlan(ctx, other, ada); !errors.As(err, &appErr) || appErr.Message != "No active coaching relationship found" {
		t.Fatalf("unrelated assign: %v", err)
	}
	// The coach has no routine yet.
	if _, err := svc.AssignWeeklyPlan(ctx, coach, ada); !errors.As(err, &appErr) || appErr.Message != "Coach has no schedule to assign" {
		t.Fatalf("empty assign: %v", err)
	}
	exec(`INSERT INTO schedules (user_id, day_of_week, sport_type_id) VALUES ($1, 2, $2), ($1, 4, $2), ($1, 6, $2)`, coach, sportID)
	if msg, err := svc.AssignWeeklyPlan(ctx, coach, ada); err != nil || msg != "Your weekly plan was assigned to the trainee." {
		t.Fatalf("assign = %q, %v", msg, err)
	}
	var days int
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM schedules WHERE user_id = $1`, ada).Scan(&days)
	if days != 3 {
		t.Errorf("ada has %d routine days, want the coach's 3", days)
	}

	// Nutrition: shared → meals, targets, and the stack's taken rate; unshared → nothing.
	nut := appcoaching.NewNutritionService(store.NewCoachingStore(pool), store.NewCoachingStore(pool), func() time.Time { return now })
	today := dates.ToYMD(now)
	exec(`INSERT INTO meal_logs (user_id, date, meal_type, free_text, kcal, protein_g) VALUES ($1, $2, 'lunch', 'Lentil soup', 320, 18), ($1, $2, 'dinner', '', 500, 30)`, ada, today)
	exec(`INSERT INTO meal_plans (user_id, status, kcal_target, protein_g_target, intake) VALUES ($1, 'active', 2100, 140, '{}')`, ada)
	var supID any
	_ = owner.QueryRow(ctx, `INSERT INTO supplements (user_id, name, created_at) VALUES ($1, 'Creatine', now() - interval '10 days') RETURNING id`, ada).Scan(&supID)
	exec(`INSERT INTO supplement_logs (user_id, supplement_id, date) VALUES ($1, $2, $3)`, ada, supID, today)
	view, err := nut.TraineeNutrition(ctx, coach, ada)
	if err != nil || !view.SharingEnabled || len(view.Days) != 1 || view.Days[0].TotalKcal != 820 || !hasLabel(view.Days[0].Meals, "Logged meal") || !hasLabel(view.Days[0].Meals, "Lentil soup") ||
		view.Targets == nil || view.Targets.Kcal != 2100 || len(view.Supplements) != 1 || view.Supplements[0].TakenDueDays != 1 || view.Supplements[0].TotalDueDays != 7 {
		t.Fatalf("nutrition view = %+v, %v", view, err)
	}
	if _, err := nut.TraineeNutrition(ctx, other, ada); !errors.As(err, &appErr) || appErr.Kind != apperr.NotFound {
		t.Fatalf("unrelated coach: %v", err)
	}
	exec(`UPDATE profiles SET nutrition_sharing_enabled = false WHERE id = $1`, ada)
	if view, _ := nut.TraineeNutrition(ctx, coach, ada); view.SharingEnabled || len(view.Days) != 0 || len(view.Supplements) != 0 {
		t.Fatalf("unshared view leaked: %+v", view)
	}
}

func hasLabel(meals []appcoaching.TraineeMeal, label string) bool {
	for _, m := range meals {
		if m.Label == label {
			return true
		}
	}
	return false
}
