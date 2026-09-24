package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestSupplementsOnPostgres(t *testing.T) {
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
	now := time.Now().UTC()
	clock := func() time.Time { return now }
	stack := supplements.NewService(store.NewSupplementStore(pool), clock)
	days := today.NewService(store.NewTodayStore(pool), clock)

	for _, in := range []supplements.AddInput{
		{Name: "Creatine", Dose: "5g"},
		{Name: "Whey", ScheduleType: "training_days"},
		{Name: "Fish oil", ScheduleType: "custom", DaysOfWeek: []int{(int(now.Weekday()) + 1) % 7}},
	} {
		if _, err := stack.Add(ctx, ada, in); err != nil {
			t.Fatal(err)
		}
	}

	day, err := days.Today(ctx, ada)
	if err != nil {
		t.Fatal(err)
	}
	creatine, whey, fish := day.Supplements[0], day.Supplements[1], day.Supplements[2]
	// No routine and no plan: training-day supplements degrade to daily.
	if !creatine.Due || !whey.Due || fish.Due || *creatine.Dose != "5g" || fish.Schedule.DaysOfWeek == nil {
		t.Fatalf("stack = %+v", day.Supplements)
	}

	// Reschedule works (the baseline lacked the UPDATE policy).
	if err := stack.Reschedule(ctx, ada, fish.ID, "daily", []int{2}); err != nil {
		t.Fatal(err)
	}
	// Taken twice is one log; other users can't touch Ada's stack.
	for range 2 {
		if err := stack.SetTaken(ctx, ada, creatine.ID, true); err != nil {
			t.Fatal(err)
		}
	}
	for _, err := range []error{
		stack.SetTaken(ctx, bob, whey.ID, true),
		stack.Reschedule(ctx, bob, whey.ID, "custom", []int{1}),
	} {
		var appErr *apperr.Error
		if !errors.As(err, &appErr) || appErr.Kind != apperr.NotFound {
			t.Fatalf("bob: %v", err)
		}
	}

	day, _ = days.Today(ctx, ada)
	if !day.Supplements[0].Taken || day.Supplements[1].Taken || !day.Supplements[2].Due ||
		day.Supplements[2].Schedule.DaysOfWeek != nil || day.Supplements[2].Label != "Every day" {
		t.Fatalf("after: %+v", day.Supplements)
	}
	var logs int
	_ = owner.QueryRow(ctx, "SELECT count(*) FROM supplement_logs WHERE user_id = $1", ada).Scan(&logs)
	if logs != 1 {
		t.Fatalf("logs = %d, want 1", logs)
	}

	// Removing cascades its logs.
	if err := stack.Remove(ctx, ada, creatine.ID); err != nil {
		t.Fatal(err)
	}
	_ = owner.QueryRow(ctx, "SELECT count(*) FROM supplement_logs WHERE user_id = $1", ada).Scan(&logs)
	if logs != 0 {
		t.Fatalf("logs after remove = %d", logs)
	}
}
