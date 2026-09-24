package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func wantAppErr(t *testing.T, err error, kind apperr.Kind) {
	t.Helper()
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Kind != kind {
		t.Fatalf("err = %v, want app error kind %d", err, kind)
	}
}

func TestTodayOnPostgres(t *testing.T) {
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

	ada := seedUser(t, owner, "ada@example.com")
	var gym int64
	if err := owner.QueryRow(ctx, "UPDATE sport_types SET xp_multiplier = 1.2 WHERE name = 'Strength training' RETURNING id").Scan(&gym); err != nil {
		t.Fatal(err)
	}

	// The database's CURRENT_DATE drives the streak settle, so use the real clock.
	now := time.Now().UTC()
	weekday := int(now.Weekday())
	if _, err := owner.Exec(ctx, `INSERT INTO schedules (user_id, day_of_week, sport_type_id, "time") VALUES
		($1, $2, $3, '18:30'), ($1, $2, $3, NULL)`, ada, weekday, gym); err != nil {
		t.Fatal(err)
	}
	// A plan that started two Mondays ago: today is in its week 3.
	created := dates.MondayOf(now).AddDate(0, 0, -14).Add(8 * time.Hour)
	var planID uuid.UUID
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at) VALUES ($1, 8, $2) RETURNING id`,
		ada, created).Scan(&planID); err != nil {
		t.Fatal(err)
	}
	past := now.AddDate(0, 0, -3)
	var runID, noteID, pastID uuid.UUID
	for _, item := range []struct {
		id        *uuid.UUID
		week, dow int
		kind      string
	}{
		{&runID, dates.PlanWeekForDate(created, now), weekday, "run"},
		{&noteID, dates.PlanWeekForDate(created, now), weekday, "meal_note"},
		{&pastID, dates.PlanWeekForDate(created, past), int(past.Weekday()), "stretch"},
	} {
		if err := owner.QueryRow(ctx, `INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title)
			VALUES ($1, $2, $3, $4, $4) RETURNING id`, planID, item.week, item.dow, item.kind).Scan(item.id); err != nil {
			t.Fatal(err)
		}
	}

	clock := func() time.Time { return now }
	days := today.NewService(store.NewTodayStore(pool), clock)
	plans := training.NewService(store.NewTrainingStore(pool), clock)

	day, err := days.Today(ctx, ada)
	if err != nil {
		t.Fatal(err)
	}
	if len(day.Sessions) != 2 || *day.Sessions[0].Time != "18:30" || day.Sessions[0].EstimatedXP != 72 || day.Sessions[0].Completed {
		t.Fatalf("sessions = %+v", day.Sessions)
	}
	if len(day.PlanItems) != 2 || day.PlanWeek != 3 || day.TotalCount != 3 || day.DoneCount != 0 {
		t.Fatalf("plan items = %+v, week %d, %d/%d", day.PlanItems, day.PlanWeek, day.DoneCount, day.TotalCount)
	}

	// Log the workout once: 72 XP; a second log of the sport today conflicts.
	logged, err := days.LogWorkout(ctx, ada, gym)
	if err != nil || logged.EarnedXP != 72 || logged.TotalXP != 72 {
		t.Fatalf("log = %+v, %v", logged, err)
	}
	_, err = days.LogWorkout(ctx, ada, gym)
	wantAppErr(t, err, apperr.Conflict)

	// Plan item: +60, idempotent, undo compensates; meal notes and closed windows refuse.
	for _, step := range []struct {
		completed bool
		want      int
	}{{true, 60}, {true, 0}, {false, -60}, {true, 60}} {
		got, err := plans.SetPlanItemCompleted(ctx, ada, runID, step.completed)
		if err != nil || got != step.want {
			t.Fatalf("completed=%v: %d, %v (want %d)", step.completed, got, err, step.want)
		}
	}
	_, err = plans.SetPlanItemCompleted(ctx, ada, noteID, true)
	wantAppErr(t, err, apperr.Invalid)
	_, err = plans.SetPlanItemCompleted(ctx, ada, pastID, true)
	wantAppErr(t, err, apperr.Invalid)
	_, err = plans.SetPlanItemCompleted(ctx, seedUser(t, owner, "bob@example.com"), runID, true)
	wantAppErr(t, err, apperr.NotFound)

	day, err = days.Today(ctx, ada)
	if err != nil {
		t.Fatal(err)
	}
	if day.Stats.XP != 132 || !day.Sessions[0].Completed || !day.Sessions[1].Completed || day.DoneCount != 3 {
		t.Fatalf("after: xp %d, sessions %+v, done %d", day.Stats.XP, day.Sessions, day.DoneCount)
	}
	var ledger int
	if err := owner.QueryRow(ctx, "SELECT sum(amount) FROM xp_transactions WHERE user_id = $1", ada).Scan(&ledger); err != nil || ledger != 132 {
		t.Fatalf("ledger = %d, %v", ledger, err)
	}
}
