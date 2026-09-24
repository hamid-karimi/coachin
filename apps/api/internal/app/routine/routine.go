// Package routine is the "My week" use cases: sport types, fixed weekly
// sessions (schedules, which drive the streak's required days), weekly
// targets (quotas, informational only), and the active AI plan's current
// week shown read-only beside them.
package routine

import (
	"context"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
)

// SportType is a selectable sport. XPMultiplier is as stored (nil = unset).
type SportType struct {
	ID           int64
	Name         string
	XPMultiplier *float64
}

// Schedule is one fixed weekly session.
type Schedule struct {
	ID           uuid.UUID
	SportTypeID  *int64
	SportName    *string
	DayOfWeek    int     // 0=Sun … 6=Sat
	Time         *string // HH:MM
	EndsOn       *string // YYYY-MM-DD
	XPMultiplier *float64
}

// Quota is one weekly target.
type Quota struct {
	ID              uuid.UUID
	SportTypeID     int64
	SportName       *string
	SessionsPerWeek int
}

// Plan is the part of a training plan the week view needs.
type Plan struct {
	ID         uuid.UUID
	CreatedAt  time.Time
	WeeksTotal int
}

// PlanItem is one AI plan session.
type PlanItem struct {
	ID          uuid.UUID
	DayOfWeek   int
	ItemType    string
	Title       string
	Description *string
	IsCompleted bool
	Details     planitem.Details
}

// Store is the persistence the use cases need. Every user-scoped method runs
// as that user (row-level security) and filters by them.
type Store interface {
	SportTypes(ctx context.Context) ([]SportType, error)
	SportTypeExists(ctx context.Context, id int64) (bool, error)
	Schedules(ctx context.Context, userID uuid.UUID) ([]Schedule, error)
	AddSchedules(ctx context.Context, userID uuid.UUID, rows []profile.ScheduleRow) error
	DeleteSchedule(ctx context.Context, userID, id uuid.UUID) error
	Quotas(ctx context.Context, userID uuid.UUID) ([]Quota, error)
	SaveQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64, sessionsPerWeek int) error
	DeleteQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64) error
	// Logs returns the user's logs dated from..to inclusive (YYYY-MM-DD).
	Logs(ctx context.Context, userID uuid.UUID, from, to string) ([]quotas.Log, error)
	// LatestActivePlan returns nil when the user has no active plan.
	LatestActivePlan(ctx context.Context, userID uuid.UUID) (*Plan, error)
	PlanWeekItems(ctx context.Context, userID, planID uuid.UUID, week int) ([]PlanItem, error)
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

// Sessions-per-week bounds, mirroring the weekly_quotas CHECK.
const (
	MinSessionsPerWeek = 1
	MaxSessionsPerWeek = 14
)

// QuotaProgress is a weekly target with this week's completed days.
type QuotaProgress struct {
	Quota
	DoneThisWeek int
}

// Week is everything the "My week" page shows.
type Week struct {
	Schedules         []Schedule
	Quotas            []QuotaProgress
	PlanItems         []PlanItem
	EstimatedWeeklyXP int64
}

// SportTypes lists the selectable sports.
func (s *Service) SportTypes(ctx context.Context) ([]SportType, error) {
	return s.store.SportTypes(ctx)
}

// Week loads the user's commitments, this Mon–Sun week's target progress,
// and the current week of their newest active plan.
func (s *Service) Week(ctx context.Context, userID uuid.UUID) (Week, error) {
	now := s.now()
	schedules, err := s.store.Schedules(ctx, userID)
	if err != nil {
		return Week{}, fmt.Errorf("load schedules: %w", err)
	}
	progress, err := s.quotaProgress(ctx, userID, now)
	if err != nil {
		return Week{}, err
	}
	items, err := s.currentPlanWeek(ctx, userID, now)
	if err != nil {
		return Week{}, err
	}

	multipliers := make([]float64, len(schedules))
	for i, schedule := range schedules {
		multipliers[i] = xp.Multiplier(schedule.XPMultiplier)
	}
	return Week{
		Schedules:         schedules,
		Quotas:            progress,
		PlanItems:         items,
		EstimatedWeeklyXP: xp.EstimatedWeeklyXP(multipliers),
	}, nil
}

func (s *Service) quotaProgress(ctx context.Context, userID uuid.UUID, now time.Time) ([]QuotaProgress, error) {
	stored, err := s.store.Quotas(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load quotas: %w", err)
	}
	monday := dates.MondayOf(now)
	logs, err := s.store.Logs(ctx, userID, dates.ToYMD(monday), dates.ToYMD(monday.AddDate(0, 0, 6)))
	if err != nil {
		return nil, fmt.Errorf("load week logs: %w", err)
	}
	targets := make([]quotas.Target, len(stored))
	for i, q := range stored {
		targets[i] = quotas.Target{SportTypeID: q.SportTypeID, SessionsPerWeek: q.SessionsPerWeek}
	}
	progress := make([]QuotaProgress, len(stored))
	for i, p := range quotas.ProgressOf(targets, logs) {
		progress[i] = QuotaProgress{Quota: stored[i], DoneThisWeek: p.Done}
	}
	return progress, nil
}

func (s *Service) currentPlanWeek(ctx context.Context, userID uuid.UUID, now time.Time) ([]PlanItem, error) {
	plan, err := s.store.LatestActivePlan(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load active plan: %w", err)
	}
	if plan == nil {
		return []PlanItem{}, nil
	}
	week := dates.PlanWeekOf(plan.CreatedAt, plan.WeeksTotal, now)
	items, err := s.store.PlanWeekItems(ctx, userID, plan.ID, week)
	if err != nil {
		return nil, fmt.Errorf("load plan week: %w", err)
	}
	return items, nil
}

// AddSchedulesInput is one sport on one or more weekdays.
type AddSchedulesInput struct {
	SportTypeID int64
	Days        []int  // 0=Sun … 6=Sat
	Time        string // HH:MM or blank
	EndsOn      string // YYYY-MM-DD or blank
}

var clockTime = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$`)

// AddSchedules adds the sport on every picked day in one transaction and
// returns how many sessions were added.
func (s *Service) AddSchedules(ctx context.Context, userID uuid.UUID, in AddSchedulesInput) (int, error) {
	if in.SportTypeID <= 0 || len(in.Days) == 0 {
		return 0, apperr.New(apperr.Invalid, "Please fill in all required fields.")
	}
	req := profile.ScheduleRequest{UserID: userID.String(), SportTypeID: in.SportTypeID, Time: &in.Time, EndsOn: &in.EndsOn}
	for _, day := range in.Days {
		req.Days = append(req.Days, float64(day))
	}
	rows := profile.ScheduleRows(req)
	if len(rows) == 0 {
		return 0, apperr.New(apperr.Invalid, "Please pick at least one day.")
	}
	if t := rows[0].Time; t != nil && !clockTime.MatchString(*t) {
		return 0, apperr.New(apperr.Invalid, "Enter a valid time.")
	}
	if end := rows[0].EndsOn; end != nil {
		if _, err := time.Parse(dates.YMDLayout, *end); err != nil {
			return 0, apperr.New(apperr.Invalid, "Enter a valid 'repeat until' date.")
		}
	}
	if err := s.requireSport(ctx, in.SportTypeID); err != nil {
		return 0, err
	}
	if err := s.store.AddSchedules(ctx, userID, rows); err != nil {
		return 0, fmt.Errorf("add schedules: %w", err)
	}
	return len(rows), nil
}

// DeleteSchedule removes one of the user's fixed sessions. Removing one that
// is already gone succeeds (idempotent).
func (s *Service) DeleteSchedule(ctx context.Context, userID, id uuid.UUID) error {
	return s.store.DeleteSchedule(ctx, userID, id)
}

// SaveQuota sets the weekly target for a sport, replacing any existing one.
func (s *Service) SaveQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64, sessionsPerWeek int) error {
	if sportTypeID <= 0 {
		return apperr.New(apperr.Invalid, "Please pick a sport.")
	}
	if sessionsPerWeek < MinSessionsPerWeek || sessionsPerWeek > MaxSessionsPerWeek {
		return apperr.New(apperr.Invalid, "Sessions per week must be between 1 and 14.")
	}
	if err := s.requireSport(ctx, sportTypeID); err != nil {
		return err
	}
	return s.store.SaveQuota(ctx, userID, sportTypeID, sessionsPerWeek)
}

// DeleteQuota removes the user's weekly target for a sport (idempotent).
func (s *Service) DeleteQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64) error {
	return s.store.DeleteQuota(ctx, userID, sportTypeID)
}

func (s *Service) requireSport(ctx context.Context, id int64) error {
	ok, err := s.store.SportTypeExists(ctx, id)
	if err != nil {
		return fmt.Errorf("check sport: %w", err)
	}
	if !ok {
		return apperr.New(apperr.Invalid, "Unknown sport. Please pick one from the list.")
	}
	return nil
}
