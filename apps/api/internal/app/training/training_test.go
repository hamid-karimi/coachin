package training

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
)

type fakeStore struct {
	item  ItemRef
	err   error
	calls int
	date  string
}

func (f *fakeStore) PlanItem(context.Context, uuid.UUID, uuid.UUID) (ItemRef, error) {
	return f.item, f.err
}
func (f *fakeStore) SetPlanItemCompleted(_ context.Context, _, _ uuid.UUID, completed bool, date string) (int, error) {
	f.calls++
	f.date = date
	if completed {
		return 60, nil
	}
	return -60, nil
}

func kindOf(err error) apperr.Kind {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Kind
	}
	return 0
}

func TestSetPlanItemCompleted(t *testing.T) {
	// Plan started Monday 2026-09-07; week 3 Tuesday (dow 2) is 2026-09-22.
	created := time.Date(2026, 9, 7, 8, 0, 0, 0, time.UTC)
	item := ItemRef{ItemType: "run", Week: 3, DayOfWeek: 2, PlanCreatedAt: created}
	at := func(day int) func() time.Time {
		return func() time.Time { return time.Date(2026, 9, day, 21, 0, 0, 0, time.UTC) }
	}
	ctx, user, id := context.Background(), uuid.New(), uuid.New()

	for day, open := range map[int]bool{21: false, 22: true, 23: true, 24: false} {
		store := &fakeStore{item: item}
		_, err := NewService(store, at(day)).SetPlanItemCompleted(ctx, user, id, true)
		if open && (err != nil || store.date != time.Date(2026, 9, day, 0, 0, 0, 0, time.UTC).Format("2006-01-02")) {
			t.Errorf("day %d: err %v, date %q", day, err, store.date)
		}
		if !open && kindOf(err) != apperr.Invalid {
			t.Errorf("day %d: want the window to be closed, got %v", day, err)
		}
	}

	// Undo is always allowed; so is re-completing an item already done.
	done := item
	done.IsCompleted = true
	for _, completed := range []bool{false, true} {
		store := &fakeStore{item: done}
		if _, err := NewService(store, at(30)).SetPlanItemCompleted(ctx, user, id, completed); err != nil || store.calls != 1 {
			t.Errorf("completed=%v on a done item: %v", completed, err)
		}
	}

	note := item
	note.ItemType = "meal_note"
	if _, err := NewService(&fakeStore{item: note}, at(22)).SetPlanItemCompleted(ctx, user, id, true); kindOf(err) != apperr.Invalid {
		t.Errorf("meal note: %v", err)
	}
	if _, err := NewService(&fakeStore{err: ErrNotFound}, at(22)).SetPlanItemCompleted(ctx, user, id, true); kindOf(err) != apperr.NotFound {
		t.Errorf("missing: %v", err)
	}
}
