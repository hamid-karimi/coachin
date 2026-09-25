package store_test

import (
	"context"
	"math/rand/v2"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// The Go streak settle (Phase 4.2c) must land exactly where legacy's
// evaluate_user_streak does: two users get the same history, one is settled
// by the legacy SQL function (dropped in 4.3; installed here from testdata),
// the other by the store.
func TestStreakSettleMatchesSQL(t *testing.T) {
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
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	legacy, err := os.ReadFile("testdata/legacy_evaluate_user_streak.sql")
	if err != nil {
		t.Fatal(err)
	}
	exec(string(legacy))
	// CURRENT_DATE drives the SQL function, so the store uses the same date.
	var today time.Time
	if err := owner.QueryRow(ctx, `SELECT CURRENT_DATE`).Scan(&today); err != nil {
		t.Fatal(err)
	}
	ymd := func(daysAgo int) string { return dates.ToYMD(today.AddDate(0, 0, -daysAgo)) }

	type state struct {
		Streak, Best, Hearts int
		Settled              *time.Time
	}
	read := func(id uuid.UUID) state {
		t.Helper()
		var s state
		if err := owner.QueryRow(ctx, `SELECT current_streak, best_streak, hearts, streak_evaluated_date FROM profiles WHERE id = $1`, id).
			Scan(&s.Streak, &s.Best, &s.Hearts, &s.Settled); err != nil {
			t.Fatal(err)
		}
		return s
	}
	// seed gives a user the scenario's history; the same seed means the same history.
	seed := func(id uuid.UUID, scenario uint64, settledDaysAgo *int) {
		rng := rand.New(rand.NewPCG(scenario, 7))
		var settled *string
		if settledDaysAgo != nil {
			s := ymd(*settledDaysAgo)
			settled = &s
		}
		exec(`UPDATE profiles SET current_streak = 4, best_streak = 9, hearts = 2, streak_evaluated_date = $2 WHERE id = $1`, id, settled)
		exec(`INSERT INTO schedules (user_id, day_of_week) VALUES ($1, 1), ($1, 4)`, id)
		exec(`INSERT INTO schedules (user_id, day_of_week, starts_on, ends_on) VALUES ($1, 5, $2, $3)`, id, ymd(20), ymd(9))
		var active, archived uuid.UUID
		if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at) VALUES ($1, 4, $2) RETURNING id`,
			id, today.AddDate(0, 0, -17).Add(10*time.Hour)).Scan(&active); err != nil {
			t.Fatal(err)
		}
		if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at, status) VALUES ($1, 4, $2, 'archived') RETURNING id`,
			id, today.AddDate(0, 0, -17)).Scan(&archived); err != nil {
			t.Fatal(err)
		}
		for week := 1; week <= 4; week++ {
			exec(`INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title) VALUES
				($1, $2, 2, 'run', 'Run'), ($1, $2, 0, 'meal_note', 'Eat'), ($1, $2, $3, 'stretch', 'Stretch'),
				($4, $2, 3, 'strength', 'Old plan')`, active, week, week%7, archived)
		}
		for daysAgo := 1; daysAgo <= 22; daysAgo++ {
			switch rng.IntN(4) {
			case 0:
				exec(`INSERT INTO logs (user_id, date, status) VALUES ($1, $2, 'completed')`, id, ymd(daysAgo))
			case 1:
				exec(`INSERT INTO logs (user_id, date, status) VALUES ($1, $2, 'skipped')`, id, ymd(daysAgo))
			}
		}
	}

	days := store.NewTodayStore(pool)
	settledAgo := func(n int) *int { return &n }
	for scenario, settled := range map[uint64]*int{1: settledAgo(22), 2: settledAgo(9), 3: nil} {
		viaSQL := seedUser(t, owner, "sql"+string(rune('0'+scenario))+"@example.com")
		viaGo := seedUser(t, owner, "go"+string(rune('0'+scenario))+"@example.com")
		seed(viaSQL, scenario, settled)
		seed(viaGo, scenario, settled)

		if err := store.WithUser(ctx, pool, viaSQL, func(tx pgx.Tx) error {
			_, err := tx.Exec(ctx, `SELECT public.legacy_evaluate_user_streak()`)
			return err
		}); err != nil {
			t.Fatal(err)
		}
		// 8 parallel Today loads settle once (the profile lock serializes them).
		var wg sync.WaitGroup
		for range 8 {
			wg.Go(func() {
				if err := days.SettleStreak(ctx, viaGo, dates.ToYMD(today)); err != nil {
					t.Error(err)
				}
			})
		}
		wg.Wait()
		want, got := read(viaSQL), read(viaGo)
		t.Logf("scenario %d: streak %d, best %d, hearts %d", scenario, got.Streak, got.Best, got.Hearts)
		if want.Streak != got.Streak || want.Best != got.Best || want.Hearts != got.Hearts ||
			want.Settled == nil || got.Settled == nil || !want.Settled.Equal(*got.Settled) {
			t.Errorf("scenario %d: SQL %+v, Go %+v", scenario, want, got)
		}

		// Settling again the same day changes nothing.
		if err := days.SettleStreak(ctx, viaGo, dates.ToYMD(today)); err != nil {
			t.Fatal(err)
		}
		if again := read(viaGo); again.Streak != got.Streak || again.Best != got.Best || again.Hearts != got.Hearts || !again.Settled.Equal(*got.Settled) {
			t.Errorf("scenario %d: re-settle moved %+v to %+v", scenario, got, again)
		}
	}
}
