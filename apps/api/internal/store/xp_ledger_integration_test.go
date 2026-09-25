package store_test

import (
	"context"
	"errors"
	"strconv"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// Migration 00009: every ledger reason but the plan-item toggle pair (and legacy's
// undated workout_log:<sport>) is once-only; existing duplicates are relabeled.
func TestXPLedgerOnceOnlyIndex(t *testing.T) {
	urls := migratedDB(t)
	ctx := context.Background()
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	exec := func(sql string, args ...any) error {
		_, err := owner.Exec(ctx, sql, args...)
		return err
	}
	ada := seedUser(t, owner, "ada@example.com")

	// Roll back to before 00009, write the duplicates legacy data can hold, migrate again.
	m, err := store.NewMigrator(ctx, urls.Owner, migrations(t))
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = m.Close() }()
	if _, err := m.DownTo(ctx, 8); err != nil {
		t.Fatal(err)
	}
	for _, reason := range []string{
		"meal_log:m1", "meal_log:m1",
		"goal_achieved:g1", "goal_achieved:g1", "goal_achieved:g1",
		"plan_item:p1", "plan_item:p1", "plan_item_undo:p1",
		"workout_log:1", "workout_log:1",
	} {
		if err := exec(`INSERT INTO xp_transactions (user_id, amount, reason) VALUES ($1, 5, $2)`, ada, reason); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := m.Up(ctx); err != nil {
		t.Fatalf("migrate with duplicates: %v", err)
	}

	rows, _ := owner.Query(ctx, `SELECT reason FROM xp_transactions WHERE user_id = $1 ORDER BY reason`, ada)
	reasons, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"goal_achieved:g1", "goal_achieved:g1#dup2", "goal_achieved:g1#dup3",
		"meal_log:m1", "meal_log:m1#dup2",
		"plan_item:p1", "plan_item:p1", "plan_item_undo:p1",
		"workout_log:1", "workout_log:1",
	}
	if len(reasons) != len(want) {
		t.Fatalf("reasons = %v", reasons)
	}
	for i := range want {
		if reasons[i] != want[i] {
			t.Fatalf("reasons = %v, want %v", reasons, want)
		}
	}

	// Once-only reasons refuse a repeat; the toggle pair and undated logs don't.
	if err := exec(`INSERT INTO xp_transactions (user_id, amount, reason) VALUES ($1, 5, 'meal_log:m1')`, ada); err == nil {
		t.Fatal("a repeated meal award was accepted")
	}
	for _, reason := range []string{"plan_item:p1", "plan_item_undo:p1", "workout_log:1"} {
		if err := exec(`INSERT INTO xp_transactions (user_id, amount, reason) VALUES ($1, 5, $2)`, ada, reason); err != nil {
			t.Fatalf("%s repeat: %v", reason, err)
		}
	}

	// A workout whose award is already in the ledger (its log gone) reads as logged.
	pool, err := store.Open(ctx, urls.App)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var sport int64
	_ = owner.QueryRow(ctx, `SELECT min(id) FROM sport_types`).Scan(&sport)
	reason := "workout_log:" + strconv.FormatInt(sport, 10) + ":2026-09-20"
	if err := exec(`INSERT INTO xp_transactions (user_id, amount, reason) VALUES ($1, 60, $2)`, ada, reason); err != nil {
		t.Fatal(err)
	}
	_, err = store.NewTodayStore(pool).LogWorkout(ctx, ada, today.NewWorkoutLog{SportTypeID: sport, Date: "2026-09-20", XP: 60, Reason: reason})
	if !errors.Is(err, today.ErrAlreadyLogged) {
		t.Fatalf("re-award = %v, want ErrAlreadyLogged", err)
	}
	var logs int
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM logs WHERE user_id = $1`, ada).Scan(&logs)
	if logs != 0 {
		t.Fatalf("the refused award left %d logs", logs)
	}
}
