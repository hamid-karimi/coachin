package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/activities"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestActivityImportOnPostgres(t *testing.T) {
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
	imp := activities.NewImporter(store.NewActivityStore(pool), nil)
	ada := seedUser(t, owner, "ada@example.com")
	day := func(offset int) string { return time.Now().AddDate(0, 0, offset).Format("2006-01-02") }
	run := func(date string) map[string]any {
		return map[string]any{"date": date, "distance_km": 5.2, "duration_min": 28.5, "source": "gpx"}
	}

	var sportID int64
	var multiplier *float32
	if err := owner.QueryRow(ctx, `SELECT id, xp_multiplier FROM sport_types WHERE name ILIKE '%run%' ORDER BY id LIMIT 1`).Scan(&sportID, &multiplier); err != nil {
		t.Skipf("no running sport seeded: %v", err)
	}
	if _, err := owner.Exec(ctx, `INSERT INTO logs (user_id, sport_type_id, date, status) VALUES ($1, $2, $3, 'completed')`, ada, sportID, day(-1)); err != nil {
		t.Fatal(err)
	}

	msg, err := imp.Import(ctx, ada, []any{run(day(0)), run(day(-1)), run(day(-2))})
	if err != nil {
		t.Fatal(err)
	}
	var logs, ledger, xp int
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM logs WHERE user_id = $1 AND notes LIKE 'Imported from watch file%'`, ada).Scan(&logs)
	_ = owner.QueryRow(ctx, `SELECT count(*), COALESCE(sum(amount), 0) FROM xp_transactions WHERE user_id = $1`, ada).Scan(&ledger, &xp)
	var balance int
	_ = owner.QueryRow(ctx, `SELECT xp FROM profiles WHERE id = $1`, ada).Scan(&balance)
	if logs != 2 || ledger != 2 || balance != xp || xp == 0 {
		t.Fatalf("%q: logs %d, ledger %d (%d XP), balance %d", msg, logs, ledger, xp, balance)
	}

	// Re-importing the same runs is a no-op.
	_, err = imp.Import(ctx, ada, []any{run(day(0)), run(day(-2))})
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Message != "Those days already have a logged run" {
		t.Fatalf("re-import: %v", err)
	}
	_ = owner.QueryRow(ctx, `SELECT xp FROM profiles WHERE id = $1`, ada).Scan(&balance)
	if balance != xp {
		t.Errorf("re-import moved XP: %d → %d", xp, balance)
	}
}
