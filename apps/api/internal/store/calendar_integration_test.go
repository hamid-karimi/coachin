package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/calendar"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestCalendarOnPostgres(t *testing.T) {
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
	var running int64
	if err := owner.QueryRow(ctx, "SELECT id FROM sport_types ORDER BY id LIMIT 1").Scan(&running); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	// Mon 07:00 always; Thu from 2026-09-24; Fri until 2026-09-18 (outside the week).
	exec(`INSERT INTO schedules (user_id, sport_type_id, day_of_week, time) VALUES ($1, $2, 1, '07:00')`, ada, running)
	exec(`INSERT INTO schedules (user_id, sport_type_id, day_of_week, starts_on) VALUES ($1, $2, 4, '2026-09-24')`, ada, running)
	exec(`INSERT INTO schedules (user_id, sport_type_id, day_of_week, ends_on) VALUES ($1, $2, 5, '2026-09-18')`, ada, running)
	exec(`INSERT INTO schedules (user_id, sport_type_id, day_of_week) VALUES ($1, $2, 2)`, bob, running)
	exec(`INSERT INTO logs (user_id, sport_type_id, date, status) VALUES ($1, $2, '2026-09-21', 'completed')`, ada, running)

	var plan uuid.UUID
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at) VALUES ($1, 8, '2026-09-08T08:00:00Z') RETURNING id`, ada).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	exec(`INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title, details) VALUES
		($1, 3, 4, 'run', 'Tempo', '{"distance_km": 8}'), ($1, 3, 0, 'run', 'Long', '{}'), ($1, 2, 4, 'run', 'Last week', '{}')`, plan)

	now := func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) }
	week, err := calendar.NewService(store.NewCalendarStore(pool), now).Week(ctx, ada, "2026-09-22")
	if err != nil {
		t.Fatal(err)
	}
	mon, thu, fri, sun := week.Days[0], week.Days[3], week.Days[4], week.Days[6]
	if len(mon.Routines) != 1 || *mon.Routines[0].Time != "07:00" || !mon.Routines[0].Done || !mon.Logged {
		t.Errorf("monday = %+v", mon)
	}
	if len(thu.Routines) != 1 || len(thu.PlanItems) != 1 || thu.PlanItems[0].Title != "Tempo" || *thu.PlanItems[0].Details.DistanceKm != 8 {
		t.Errorf("thursday = %+v", thu)
	}
	if len(fri.Routines) != 0 || len(sun.PlanItems) != 1 {
		t.Errorf("friday %+v, sunday %+v", fri.Routines, sun.PlanItems)
	}
	if len(week.Days[1].Routines) != 0 {
		t.Error("bob's schedule leaked into ada's calendar")
	}
}
