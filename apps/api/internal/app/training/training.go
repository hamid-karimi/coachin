// Package training is the AI training-plan use cases. For now: marking a
// plan item done or not done (used by Today, Training, and Calendar).
package training

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
)

// ItemRef is what the completion rules need about a plan item.
type ItemRef struct {
	ItemType      string
	Week          int
	DayOfWeek     int
	IsCompleted   bool
	PlanCreatedAt time.Time
}

// ErrNotFound means no such item exists among the user's plans.
var ErrNotFound = errors.New("plan item not found")

// Store is the persistence the use cases need.
type Store interface {
	// PlanItem returns ErrNotFound unless the item is in one of the user's plans.
	PlanItem(ctx context.Context, userID, itemID uuid.UUID) (ItemRef, error)
	// SetPlanItemCompleted toggles the item, adds/removes its log dated date,
	// and awards/compensates XP idempotently; returns the XP delta.
	SetPlanItemCompleted(ctx context.Context, userID, itemID uuid.UUID, completed bool, date string) (awardedXP int, err error)
}

// Service runs the use cases. now is injectable for tests.
type Service struct {
	store Store
	now   func() time.Time
}

// NewService builds the service; now defaults to time.Now.
func NewService(store Store, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{store: store, now: now}
}

// SetPlanItemCompleted marks an item done (only on its day or the day after)
// or not done (always), returning the XP delta: positive on a first
// completion, negative on undo, 0 when nothing changes.
func (s *Service) SetPlanItemCompleted(ctx context.Context, userID, itemID uuid.UUID, completed bool) (int, error) {
	item, err := s.store.PlanItem(ctx, userID, itemID)
	if errors.Is(err, ErrNotFound) {
		return 0, apperr.New(apperr.NotFound, "Plan item not found")
	}
	if err != nil {
		return 0, fmt.Errorf("load plan item: %w", err)
	}
	if !planitem.Checkable(item.ItemType) {
		return 0, apperr.New(apperr.Invalid, "Meal notes cannot be completed")
	}
	now := s.now()
	today, _ := time.ParseInLocation(dates.YMDLayout, dates.ToYMD(now), now.Location())
	itemDate := dates.PlanItemDate(item.PlanCreatedAt.In(now.Location()), item.Week, item.DayOfWeek)
	if completed && !item.IsCompleted && !planitem.LogWindowOpen(itemDate, today) {
		return 0, apperr.New(apperr.Invalid, "You can mark a session done on its day or the day after.")
	}
	awarded, err := s.store.SetPlanItemCompleted(ctx, userID, itemID, completed, dates.ToYMD(now))
	if err != nil {
		return 0, fmt.Errorf("set plan item completed: %w", err)
	}
	return awarded, nil
}
