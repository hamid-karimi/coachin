package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// seedUser inserts an account + profile with the owner role.
func seedUser(t *testing.T, owner *pgx.Conn, email string) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var id uuid.UUID
	if err := owner.QueryRow(ctx, "INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id", email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, "INSERT INTO profiles (id, email) VALUES ($1, $2)", id, email); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestRoutineWeekOnPostgres(t *testing.T) {
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

	ada, bob := seedUser(t, owner, "ada@example.com"), seedUser(t, owner, "bob@example.com")
	var running, gym int64
	if err := owner.QueryRow(ctx, "SELECT id FROM sport_types WHERE name = 'Running'").Scan(&running); err != nil {
		t.Fatal(err)
	}
	if err := owner.QueryRow(ctx, "UPDATE sport_types SET xp_multiplier = 1.2 WHERE name = 'Strength training' RETURNING id").Scan(&gym); err != nil {
		t.Fatal(err)
	}

	// Wednesday 2026-09-23; Ada's plan started two Mondays ago → week 3.
	now := time.Date(2026, 9, 23, 10, 0, 0, 0, time.UTC)
	var planID uuid.UUID
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at)
		VALUES ($1, 8, '2026-09-07T08:00:00Z') RETURNING id`, ada).Scan(&planID); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, `INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title, details) VALUES
		($1, 3, 2, 'run', 'Tempo run', '{"distance_km": 8, "pace_min_km": "5:10", "sets": 3}'),
		($1, 2, 2, 'run', 'Last week', '{}')`, planID); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, `INSERT INTO logs (user_id, date, sport_type_id, status) VALUES
		($1, '2026-09-21', $2, 'completed'), ($1, '2026-09-22', $2, 'completed'),
		($1, '2026-09-20', $2, 'completed'), ($3, '2026-09-22', $2, 'completed')`, ada, running, bob); err != nil {
		t.Fatal(err)
	}

	svc := routine.NewService(store.NewRoutineStore(pool), func() time.Time { return now })

	sports, err := svc.SportTypes(ctx)
	if err != nil || len(sports) != 18 {
		t.Fatalf("sports = %d, %v", len(sports), err)
	}

	if n, err := svc.AddSchedules(ctx, ada, routine.AddSchedulesInput{SportTypeID: running, Days: []int{1, 3}, Time: "07:00"}); err != nil || n != 2 {
		t.Fatalf("add running: %d, %v", n, err)
	}
	if _, err := svc.AddSchedules(ctx, ada, routine.AddSchedulesInput{SportTypeID: gym, Days: []int{5}, EndsOn: "2026-12-31"}); err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveQuota(ctx, ada, running, 2); err != nil {
		t.Fatal(err)
	}
	if err := svc.SaveQuota(ctx, ada, running, 3); err != nil { // upsert, not a second row
		t.Fatal(err)
	}

	week, err := svc.Week(ctx, ada)
	if err != nil {
		t.Fatal(err)
	}
	if len(week.Schedules) != 3 || *week.Schedules[0].Time != "07:00" || *week.Schedules[0].SportName != "Running" ||
		week.Schedules[2].Time != nil || *week.Schedules[2].EndsOn != "2026-12-31" || *week.Schedules[2].XPMultiplier != 1.2 {
		t.Fatalf("schedules = %+v", week.Schedules)
	}
	if week.EstimatedWeeklyXP != 192 { // 60 + 60 + 72
		t.Errorf("estimate = %d", week.EstimatedWeeklyXP)
	}
	if len(week.Quotas) != 1 || week.Quotas[0].SessionsPerWeek != 3 || week.Quotas[0].DoneThisWeek != 2 {
		t.Errorf("quotas = %+v", week.Quotas)
	}
	if len(week.PlanItems) != 1 || week.PlanItems[0].Title != "Tempo run" || *week.PlanItems[0].Details.DistanceKm != 8 {
		t.Errorf("plan items = %+v", week.PlanItems)
	}

	// Bob sees none of it and cannot remove Ada's rows.
	bobWeek, err := svc.Week(ctx, bob)
	if err != nil || len(bobWeek.Schedules) != 0 || len(bobWeek.Quotas) != 0 || len(bobWeek.PlanItems) != 0 {
		t.Fatalf("bob week = %+v, %v", bobWeek, err)
	}
	if err := svc.DeleteSchedule(ctx, bob, week.Schedules[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteQuota(ctx, bob, running); err != nil {
		t.Fatal(err)
	}
	if after, _ := svc.Week(ctx, ada); len(after.Schedules) != 3 || len(after.Quotas) != 1 {
		t.Fatalf("bob removed ada's rows: %+v", after)
	}

	// Ada removes her own.
	if err := svc.DeleteSchedule(ctx, ada, week.Schedules[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := svc.DeleteQuota(ctx, ada, running); err != nil {
		t.Fatal(err)
	}
	if after, _ := svc.Week(ctx, ada); len(after.Schedules) != 2 || len(after.Quotas) != 0 {
		t.Fatalf("after delete: %+v", after)
	}
}
