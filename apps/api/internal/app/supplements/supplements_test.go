package supplements

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
)

type fakeStore struct {
	count    int
	added    [2]string
	schedule supplements.Schedule
	owned    bool
	takenOn  string
}

func (f *fakeStore) CountSupplements(context.Context, uuid.UUID) (int, error) { return f.count, nil }
func (f *fakeStore) AddSupplement(_ context.Context, _ uuid.UUID, name string, dose *string, s supplements.Schedule) error {
	f.added = [2]string{name, ""}
	if dose != nil {
		f.added[1] = *dose
	}
	f.schedule = s
	return nil
}
func (f *fakeStore) UpdateSchedule(_ context.Context, _, _ uuid.UUID, s supplements.Schedule) (bool, error) {
	f.schedule = s
	return f.owned, nil
}
func (f *fakeStore) DeleteSupplement(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (f *fakeStore) Owns(context.Context, uuid.UUID, uuid.UUID) (bool, error)     { return f.owned, nil }
func (f *fakeStore) SetTaken(_ context.Context, _, _ uuid.UUID, date string, _ bool) error {
	f.takenOn = date
	return nil
}

func kindOf(err error) apperr.Kind {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Kind
	}
	return 0
}

var clock = func() time.Time { return time.Date(2026, 9, 24, 23, 0, 0, 0, time.UTC) }

func TestAdd(t *testing.T) {
	ctx, user := context.Background(), uuid.New()
	store := &fakeStore{}
	name, err := NewService(store, clock).Add(ctx, user, AddInput{
		Name: "  " + strings.Repeat("é", 70), Dose: " 5g ", ScheduleType: "custom", DaysOfWeek: []int{3, 1, 3},
	})
	if err != nil || len([]rune(name)) != 60 || store.added[1] != "5g" || len(store.schedule.DaysOfWeek) != 2 {
		t.Fatalf("name %q, added %v, schedule %+v, %v", name, store.added, store.schedule, err)
	}
	if _, err := NewService(&fakeStore{}, clock).Add(ctx, user, AddInput{Name: "  "}); kindOf(err) != apperr.Invalid {
		t.Errorf("blank name: %v", err)
	}
	if _, err := NewService(&fakeStore{count: 20}, clock).Add(ctx, user, AddInput{Name: "Zinc"}); kindOf(err) != apperr.Invalid {
		t.Errorf("full stack: %v", err)
	}
	blankDose := &fakeStore{}
	if _, err := NewService(blankDose, clock).Add(ctx, user, AddInput{Name: "Zinc", Dose: " "}); err != nil || blankDose.added[1] != "" {
		t.Errorf("blank dose stored: %v %v", blankDose.added, err)
	}
}

func TestRescheduleAndTaken(t *testing.T) {
	ctx, user, id := context.Background(), uuid.New(), uuid.New()
	if err := NewService(&fakeStore{}, clock).Reschedule(ctx, user, id, "daily", nil); kindOf(err) != apperr.NotFound {
		t.Errorf("not owned: %v", err)
	}
	if err := NewService(&fakeStore{}, clock).SetTaken(ctx, user, id, true); kindOf(err) != apperr.NotFound {
		t.Errorf("taken, not owned: %v", err)
	}
	store := &fakeStore{owned: true}
	if err := NewService(store, clock).SetTaken(ctx, user, id, true); err != nil || store.takenOn != "2026-09-24" {
		t.Errorf("taken on %q: %v", store.takenOn, err)
	}
}
