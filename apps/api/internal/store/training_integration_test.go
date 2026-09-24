package store_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestProgramsOnPostgres(t *testing.T) {
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
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)
	var race, lift uuid.UUID
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at, race_date, goal_time, intake)
		VALUES ($1, 8, '2026-09-07T08:00:00Z', '2026-11-01', '3:59:00', '{"race_target":"full","race_distance_km":42.195}') RETURNING id`, ada).Scan(&race); err != nil {
		t.Fatal(err)
	}
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at, plan_kind, created_by)
		VALUES ($1, 10, '2026-09-14T08:00:00Z', 'hypertrophy', $2) RETURNING id`, ada, bob).Scan(&lift); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, `INSERT INTO weekly_checkins (plan_id, week, scorecard, decision) VALUES ($1, 2, '{}', 'advance')`, race); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, `INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title, details) VALUES
		($1, 1, 2, 'run', 'Easy run', '{"distance_km": 6}'), ($2, 1, 1, 'strength', 'Upper; A', '{}')`, race, lift); err != nil {
		t.Fatal(err)
	}

	programs := training.NewPrograms(store.NewTrainingStore(pool), func() time.Time { return now })
	list, err := programs.List(ctx, ada)
	if err != nil || len(list) != 2 {
		t.Fatalf("list = %+v, %v", list, err)
	}
	// Ordered by plan_kind, as the legacy app: hypertrophy before race.
	l, r := list[0], list[1]
	if *r.RaceTarget != "full" || *r.RaceDistanceKm != 42.195 || *r.RaceDate != "2026-11-01" || r.CheckinDue || r.CurrentWeek != 3 {
		t.Errorf("race = %+v", r)
	}
	if l.PlanKind != "hypertrophy" || !l.FromCoach || !l.CheckinDue || l.ReviewWeek != 1 {
		t.Errorf("lift = %+v", l)
	}

	calendar, err := programs.CalendarExport(ctx, ada)
	if err != nil || !strings.Contains(calendar, "SUMMARY:Easy run") || !strings.Contains(calendar, `SUMMARY:Upper\; A`) ||
		!strings.Contains(calendar, "DTSTART;VALUE=DATE:20260908") {
		t.Fatalf("calendar = %q, %v", calendar, err)
	}

	// Bob can't archive Ada's plan; Ada can.
	if err := programs.Archive(ctx, bob, race); err != nil {
		t.Fatal(err)
	}
	if list, _ := programs.List(ctx, ada); len(list) != 2 {
		t.Fatalf("bob archived ada's plan")
	}
	if err := programs.Archive(ctx, ada, race); err != nil {
		t.Fatal(err)
	}
	if list, _ := programs.List(ctx, ada); len(list) != 1 || list[0].ID != lift {
		t.Fatalf("after archive: %+v", list)
	}
	if _, err := programs.CalendarExport(ctx, bob); err == nil {
		t.Fatal("bob has no plan: want 404")
	}
}
