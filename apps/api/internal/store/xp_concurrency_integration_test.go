package store_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	appprofile "github.com/hamid-karimi/coachin/apps/api/internal/app/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
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

	// 8 single-meal logs at once: the 3-a-day cap still pays exactly 15.
	meals := store.NewNutritionStore(pool)
	day, yesterday := dates.ToYMD(now), dates.ToYMD(now.AddDate(0, 0, -1))
	mealXP := parallel(8, func() int {
		meal := appnutrition.NewMeal{MealType: "snack", Name: "Apple", EntryMethod: "manual", Nutrients: nutrition.Nutrients{Kcal: 80}}
		awards, err := meals.LogMeals(ctx, ada, day, yesterday, []appnutrition.NewMeal{meal}, appnutrition.DefaultMealRules)
		if err != nil {
			t.Error(err)
		}
		return awards.MealXP
	})
	if mealXP != 15 {
		t.Fatalf("8 parallel meals paid %d, want 15", mealXP)
	}

	// Parallel readings that all reach one goal pay its +200 once.
	profiles := appprofile.NewService(store.NewProfileStore(pool), nil)
	if _, err := profiles.CreateGoal(ctx, ada, appprofile.GoalInput{Type: "weight", Target: 70}); err != nil {
		t.Fatal(err)
	}
	if _, err := profiles.AddMeasurement(ctx, ada, ptrTo(80.0), nil); err != nil { // the baseline
		t.Fatal(err)
	}
	achieved := parallel(8, func() int {
		logged, err := profiles.AddMeasurement(ctx, ada, ptrTo(69.5), nil)
		if err != nil {
			t.Error(err)
		}
		return len(logged.Achieved)
	})
	if achieved != 1 {
		t.Fatalf("8 parallel crossings achieved %d goals, want 1", achieved)
	}
	if ledger, profile, _ := balance(); ledger != 70+15+200 || profile != ledger {
		t.Fatalf("after meals and goal: ledger %d, profile %d", ledger, profile)
	}

	// 8 parallel confirms of one week's check-in: one lands (+20), the rest are refused.
	prescription := "Goblet squat 3x10"
	var refused int
	var refusedMu sync.Mutex
	checkinXP := parallel(8, func() int {
		got, err := st.ApplyWeekAdjustment(ctx, ada, training.WeekAdjustment{
			PlanID: plan, CheckinWeek: 1, TargetWeek: 2, Decision: "advance",
			Items: []aigen.PlanItemInput{{DayOfWeek: 3, ItemType: "strength", Title: "Legs", Description: &prescription}},
		})
		if errors.Is(err, training.ErrAlreadyCheckedIn) {
			refusedMu.Lock()
			refused++
			refusedMu.Unlock()
		} else if err != nil {
			t.Error(err)
		}
		return got
	})
	if checkinXP != 20 || refused != 7 {
		t.Fatalf("8 parallel check-ins paid %d with %d refused, want 20 and 7", checkinXP, refused)
	}
	var description string
	if err := owner.QueryRow(ctx, `SELECT description FROM plan_items WHERE plan_id = $1 AND week = 2`, plan).Scan(&description); err != nil || description != prescription {
		t.Fatalf("rewritten item description = %q, %v", description, err)
	}
}
