package store_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// Parallel duplicates pay exactly once (Phase 4.2): plan-item taps and session
// logs run under the profile lock, and the ledger index backs the checks.
func TestParallelAwardsPayOnce(t *testing.T) {
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
	now := time.Now().UTC()
	created := dates.MondayOf(now).Add(8 * time.Hour)
	var plan, item uuid.UUID
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at) VALUES ($1, 8, $2) RETURNING id`,
		ada, created).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if err := owner.QueryRow(ctx, `INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title)
		VALUES ($1, $2, $3, 'strength', 'Upper body') RETURNING id`, plan, dates.PlanWeekForDate(created, now), int(now.Weekday())).Scan(&item); err != nil {
		t.Fatal(err)
	}
	st := store.NewTrainingStore(pool)
	plans := training.NewService(st, func() time.Time { return now })

	parallel := func(n int, call func() int) int {
		var (
			wg    sync.WaitGroup
			mu    sync.Mutex
			total int
		)
		for range n {
			wg.Go(func() {
				got := call()
				mu.Lock()
				total += got
				mu.Unlock()
			})
		}
		wg.Wait()
		return total
	}
	balance := func() (ledger, profile, logs int) {
		t.Helper()
		if err := owner.QueryRow(ctx, `SELECT COALESCE(sum(amount), 0) FROM xp_transactions WHERE user_id = $1`, ada).Scan(&ledger); err != nil {
			t.Fatal(err)
		}
		if err := owner.QueryRow(ctx, `SELECT xp FROM profiles WHERE id = $1`, ada).Scan(&profile); err != nil {
			t.Fatal(err)
		}
		if err := owner.QueryRow(ctx, `SELECT count(*) FROM logs WHERE user_id = $1`, ada).Scan(&logs); err != nil {
			t.Fatal(err)
		}
		return ledger, profile, logs
	}
	toggle := func(completed bool) func() int {
		return func() int {
			got, err := plans.SetPlanItemCompleted(ctx, ada, item, completed)
			if err != nil {
				t.Error(err)
			}
			return got
		}
	}

	if got := parallel(8, toggle(true)); got != 60 {
		t.Fatalf("8 parallel done taps paid %d, want 60", got)
	}
	if ledger, profile, logs := balance(); ledger != 60 || profile != 60 || logs != 1 {
		t.Fatalf("after done: ledger %d, profile %d, logs %d", ledger, profile, logs)
	}
	if got := parallel(8, toggle(false)); got != -60 {
		t.Fatalf("8 parallel undos moved %d, want -60", got)
	}
	if ledger, profile, logs := balance(); ledger != 0 || profile != 0 || logs != 0 {
		t.Fatalf("after undo: ledger %d, profile %d, logs %d", ledger, profile, logs)
	}
	if got := parallel(1, toggle(true)); got != 60 {
		t.Fatalf("redo paid %d, want 60", got)
	}

	sessions := training.NewSessions(st, cannedAI{})
	in := training.SessionInput{PlanItemID: item, Sport: "strength", RPE: ptrTo(7)}
	awarded := parallel(8, func() int {
		logged, err := sessions.LogSession(ctx, ada, in)
		if err != nil && appKind(err) == 0 {
			t.Error(err)
		}
		return logged.AwardedXP
	})
	if awarded != 10 {
		t.Fatalf("8 parallel session logs paid %d, want 10", awarded)
	}
	if ledger, profile, _ := balance(); ledger != 70 || profile != 70 {
		t.Fatalf("after session logs: ledger %d, profile %d", ledger, profile)
	}
}
