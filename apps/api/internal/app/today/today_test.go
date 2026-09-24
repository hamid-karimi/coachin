package today

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
)

type fakeStore struct {
	multiplier *float64
	found      bool
	logged     NewWorkoutLog
	logErr     error
	stack      []SupplementRow
	taken      []uuid.UUID
	hasRoutine bool
}

func (f *fakeStore) SettleStreak(context.Context, uuid.UUID) error { return nil }
func (f *fakeStore) Stats(context.Context, uuid.UUID) (ProfileStats, error) {
	return ProfileStats{XP: 2500, Hearts: 7, LeagueTier: "silver"}, nil
}
func (f *fakeStore) SessionsOn(context.Context, uuid.UUID, int, string) ([]SessionRow, error) {
	return nil, nil
}
func (f *fakeStore) LoggedSportsOn(context.Context, uuid.UUID, string) ([]int64, error) {
	return nil, nil
}
func (f *fakeStore) ActivePlans(context.Context, uuid.UUID) ([]routine.Plan, error) {
	// Finished last year: no week covers today.
	return []routine.Plan{{CreatedAt: time.Date(2025, 1, 6, 0, 0, 0, 0, time.UTC), WeeksTotal: 8}}, nil
}
func (f *fakeStore) PlanItemsOn(context.Context, uuid.UUID, int, map[uuid.UUID]int) ([]PlanItemRow, error) {
	return nil, errors.New("should not be called without a covering plan")
}
func (f *fakeStore) Quotas(context.Context, uuid.UUID) ([]routine.Quota, error) { return nil, nil }
func (f *fakeStore) Logs(context.Context, uuid.UUID, string, string) ([]quotas.Log, error) {
	return nil, nil
}
func (f *fakeStore) LastProgressPhotoAt(context.Context, uuid.UUID) (*time.Time, error) {
	return nil, nil
}
func (f *fakeStore) Supplements(context.Context, uuid.UUID) ([]SupplementRow, error) {
	return f.stack, nil
}
func (f *fakeStore) TakenSupplementsOn(context.Context, uuid.UUID, string) ([]uuid.UUID, error) {
	return f.taken, nil
}
func (f *fakeStore) HasAnySchedule(context.Context, uuid.UUID) (bool, error) {
	return f.hasRoutine, nil
}
func (f *fakeStore) SportMultiplier(context.Context, int64) (*float64, bool, error) {
	return f.multiplier, f.found, nil
}
func (f *fakeStore) LogWorkout(_ context.Context, _ uuid.UUID, log NewWorkoutLog) (int64, error) {
	f.logged = log
	return 100 + log.XP, f.logErr
}

var thursday = func() time.Time { return time.Date(2026, 9, 24, 9, 0, 0, 0, time.UTC) }

func kindOf(err error) apperr.Kind {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Kind
	}
	return 0
}

func TestTodayStatsAndEndedPlans(t *testing.T) {
	day, err := NewService(&fakeStore{}, thursday).Today(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if day.Date != "2026-09-24" || day.Weekday != 4 || day.Stats.Level != 3 || day.Stats.LevelProgress.CurrentXP != 500 ||
		day.Stats.Hearts != 3 || day.Stats.Tier != "silver" {
		t.Errorf("day = %+v", day)
	}
	if day.ActivePlans != 1 || day.PlanWeek != 0 || day.PlanItems == nil || len(day.PlanItems) != 0 {
		t.Errorf("plan = %d active, week %d, items %#v", day.ActivePlans, day.PlanWeek, day.PlanItems)
	}
}

func TestLogWorkout(t *testing.T) {
	ctx, user := context.Background(), uuid.New()
	half := 1.5
	store := &fakeStore{multiplier: &half, found: true}
	got, err := NewService(store, thursday).LogWorkout(ctx, user, 4)
	if err != nil || got.EarnedXP != 90 || got.TotalXP != 190 || store.logged.Reason != "workout_log:4:2026-09-24" {
		t.Fatalf("got %+v, %v, logged %+v", got, err, store.logged)
	}
	unset := &fakeStore{found: true}
	if got, _ := NewService(unset, thursday).LogWorkout(ctx, user, 4); got.EarnedXP != 60 {
		t.Errorf("unset multiplier earned %d, want 60", got.EarnedXP)
	}
	if _, err := NewService(&fakeStore{}, thursday).LogWorkout(ctx, user, 0); kindOf(err) != apperr.Invalid {
		t.Errorf("no sport: %v", err)
	}
	if _, err := NewService(&fakeStore{}, thursday).LogWorkout(ctx, user, 9); kindOf(err) != apperr.Invalid {
		t.Errorf("unknown sport: %v", err)
	}
	dup := &fakeStore{found: true, logErr: ErrAlreadyLogged}
	if _, err := NewService(dup, thursday).LogWorkout(ctx, user, 4); kindOf(err) != apperr.Conflict {
		t.Errorf("duplicate: %v", err)
	}
}

func TestSupplementsDueToday(t *testing.T) {
	creatine, whey, fish := uuid.New(), uuid.New(), uuid.New()
	stack := []SupplementRow{
		{ID: creatine, Name: "Creatine", Schedule: supplements.Schedule{ScheduleType: supplements.Daily}},
		{ID: whey, Name: "Whey", Schedule: supplements.Schedule{ScheduleType: supplements.TrainingDays}},
		{ID: fish, Name: "Fish oil", Schedule: supplements.Schedule{ScheduleType: supplements.Custom, DaysOfWeek: []int{1, 3}}},
	}
	due := func(store *fakeStore) map[string]bool {
		t.Helper()
		day, err := NewService(store, thursday).Today(context.Background(), uuid.New())
		if err != nil {
			t.Fatal(err)
		}
		got := map[string]bool{}
		for _, s := range day.Supplements {
			got[s.Name] = s.Due
		}
		return got
	}
	// The fake's only plan has ended, but it is still "active": a rest day.
	if got := due(&fakeStore{stack: stack}); got["Creatine"] != true || got["Whey"] != false || got["Fish oil"] != false {
		t.Errorf("rest day within a plan: %v", got)
	}
	day, _ := NewService(&fakeStore{stack: stack, taken: []uuid.UUID{creatine}}, thursday).Today(context.Background(), uuid.New())
	if !day.Supplements[0].Taken || day.Supplements[1].Taken || day.Supplements[2].Label != "Mon · Wed" {
		t.Errorf("taken/labels: %+v", day.Supplements)
	}
}
