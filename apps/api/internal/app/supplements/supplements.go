// Package supplements is the daily-stack use cases: add, reschedule, remove,
// and check off "taken today". Informational only — never XP, streaks, or
// hearts (FORMULAS.md §13). Listing with due-today lives in app/today, which
// knows whether today is a training day.
package supplements

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
)

// Limits from the legacy app.
const (
	MaxStack      = 20
	MaxNameLength = 60
	MaxDoseLength = 40
)

// Store is the persistence the use cases need; every call is scoped to the
// user.
type Store interface {
	CountSupplements(ctx context.Context, userID uuid.UUID) (int, error)
	AddSupplement(ctx context.Context, userID uuid.UUID, name string, dose *string, schedule supplements.Schedule) error
	// UpdateSchedule reports false when the supplement is not the user's.
	UpdateSchedule(ctx context.Context, userID, id uuid.UUID, schedule supplements.Schedule) (bool, error)
	DeleteSupplement(ctx context.Context, userID, id uuid.UUID) error
	Owns(ctx context.Context, userID, id uuid.UUID) (bool, error)
	SetTaken(ctx context.Context, userID, id uuid.UUID, date string, taken bool) error
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

// AddInput is a new supplement as submitted.
type AddInput struct {
	Name, Dose, ScheduleType string
	DaysOfWeek               []int
}

// truncate keeps the first n characters (not bytes).
func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

// Add puts a supplement in the stack and returns its trimmed name.
func (s *Service) Add(ctx context.Context, userID uuid.UUID, in AddInput) (string, error) {
	name := truncate(strings.TrimSpace(in.Name), MaxNameLength)
	if name == "" {
		return "", apperr.New(apperr.Invalid, "Give the supplement a name")
	}
	var dose *string
	if d := truncate(strings.TrimSpace(in.Dose), MaxDoseLength); d != "" {
		dose = &d
	}
	count, err := s.store.CountSupplements(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("count supplements: %w", err)
	}
	if count >= MaxStack {
		return "", apperr.New(apperr.Invalid, fmt.Sprintf("Keep the stack under %d items", MaxStack))
	}
	if err := s.store.AddSupplement(ctx, userID, name, dose, supplements.Normalize(in.ScheduleType, in.DaysOfWeek)); err != nil {
		return "", fmt.Errorf("add supplement: %w", err)
	}
	return name, nil
}

// Reschedule changes when a supplement is due.
func (s *Service) Reschedule(ctx context.Context, userID, id uuid.UUID, scheduleType string, days []int) error {
	ok, err := s.store.UpdateSchedule(ctx, userID, id, supplements.Normalize(scheduleType, days))
	if err != nil {
		return fmt.Errorf("update schedule: %w", err)
	}
	if !ok {
		return apperr.New(apperr.NotFound, "Supplement not found")
	}
	return nil
}

// Remove deletes a supplement and its logs (idempotent).
func (s *Service) Remove(ctx context.Context, userID, id uuid.UUID) error {
	return s.store.DeleteSupplement(ctx, userID, id)
}

// SetTaken checks today's dose off (or back on); repeating it is harmless.
func (s *Service) SetTaken(ctx context.Context, userID, id uuid.UUID, taken bool) error {
	ok, err := s.store.Owns(ctx, userID, id)
	if err != nil {
		return fmt.Errorf("check supplement: %w", err)
	}
	if !ok {
		return apperr.New(apperr.NotFound, "Supplement not found")
	}
	return s.store.SetTaken(ctx, userID, id, dates.ToYMD(s.now()), taken)
}
