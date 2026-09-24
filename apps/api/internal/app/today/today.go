// Package today is the daily execution surface: stats, today's fixed
// sessions and AI plan items, weekly-target chips, and logging a workout.
package today

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/progress"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/streak"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/tiers"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
)

// ProfileStats are the stored gamification counters.
type ProfileStats struct {
	XP            int64
	CurrentStreak int
	BestStreak    int
	Hearts        int
	LeagueTier    string
}

// SessionRow is a fixed session scheduled today.
type SessionRow struct {
	ScheduleID   uuid.UUID
	SportTypeID  *int64
	SportName    *string
	Time         *string // HH:MM
	XPMultiplier *float64
}

// PlanItemRow is a plan item with the plan week it belongs to.
type PlanItemRow struct {
	routine.PlanItem
	PlanID uuid.UUID
	Week   int
}

// NewWorkoutLog is one routine workout to record with its XP award.
type NewWorkoutLog struct {
	SportTypeID int64
	Date        string // YYYY-MM-DD
	XP          int64
	Reason      string
}

// SupplementRow is one supplement in the user's stack.
type SupplementRow struct {
	ID       uuid.UUID
	Name     string
	Dose     *string
	Schedule supplements.Schedule
}

// ErrAlreadyLogged means the sport already has a log on that date.
var ErrAlreadyLogged = errors.New("already logged today")

// Store is the persistence the use cases need; user-scoped methods run as
// that user.
type Store interface {
	// SettleStreak evaluates every unsettled past day (idempotent).
	SettleStreak(ctx context.Context, userID uuid.UUID) error
	Stats(ctx context.Context, userID uuid.UUID) (ProfileStats, error)
	SessionsOn(ctx context.Context, userID uuid.UUID, weekday int, date string) ([]SessionRow, error)
	LoggedSportsOn(ctx context.Context, userID uuid.UUID, date string) ([]int64, error)
	ActivePlans(ctx context.Context, userID uuid.UUID) ([]routine.Plan, error)
	// PlanItemsOn returns the weekday's items of each plan's given week.
	PlanItemsOn(ctx context.Context, userID uuid.UUID, weekday int, weekByPlan map[uuid.UUID]int) ([]PlanItemRow, error)
	Quotas(ctx context.Context, userID uuid.UUID) ([]routine.Quota, error)
	Logs(ctx context.Context, userID uuid.UUID, from, to string) ([]quotas.Log, error)
	LastProgressPhotoAt(ctx context.Context, userID uuid.UUID) (*time.Time, error)
	Supplements(ctx context.Context, userID uuid.UUID) ([]SupplementRow, error)
	TakenSupplementsOn(ctx context.Context, userID uuid.UUID, date string) ([]uuid.UUID, error)
	HasAnySchedule(ctx context.Context, userID uuid.UUID) (bool, error)
	// SportMultiplier returns found=false for an unknown sport.
	SportMultiplier(ctx context.Context, sportTypeID int64) (multiplier *float64, found bool, err error)
	// LogWorkout records the log, its XP ledger row, and the new balance in
	// one transaction; ErrAlreadyLogged when the sport is logged that date.
	LogWorkout(ctx context.Context, userID uuid.UUID, log NewWorkoutLog) (totalXP int64, err error)
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

// Stats is the header: level, XP bar, streak, hearts, league.
type Stats struct {
	XP            int64
	Level         int64
	LevelProgress xp.Progress
	CurrentStreak int
	BestStreak    int
	Hearts        int
	Tier          tiers.Tier
}

// Session is a fixed session on today's list.
type Session struct {
	SessionRow
	Multiplier  float64
	EstimatedXP int64
	Completed   bool
}

// PlanItem is a plan item on today's list.
type PlanItem struct {
	PlanItemRow
	Date string // YYYY-MM-DD
}

// Supplement is a stack entry with today's state.
type Supplement struct {
	SupplementRow
	Label string
	Due   bool // on today's checklist
	Taken bool // logged today
}

// Day is everything the Today page shows.
type Day struct {
	Date          string
	Weekday       int // 0=Sun … 6=Sat
	Stats         Stats
	Sessions      []Session
	PlanItems     []PlanItem
	ActivePlans   int
	PlanWeek      int // week of the first plan covering today; 0 = none
	HardCollision bool
	DoneCount     int
	TotalCount    int
	Quotas        []routine.QuotaProgress
	// ProgressPhotoDue: nudge toward the progress-photo journal.
	ProgressPhotoDue bool
	HasProgressPhoto bool
	// Supplements is the whole stack; the checklist shows the Due ones.
	Supplements []Supplement
}

// Today settles the streak, then loads the day.
func (s *Service) Today(ctx context.Context, userID uuid.UUID) (Day, error) {
	now := s.now()
	date, weekday := dates.ToYMD(now), int(now.Weekday())

	if err := s.store.SettleStreak(ctx, userID); err != nil {
		return Day{}, fmt.Errorf("settle streak: %w", err)
	}
	stored, err := s.store.Stats(ctx, userID)
	if err != nil {
		return Day{}, fmt.Errorf("load stats: %w", err)
	}
	day := Day{Date: date, Weekday: weekday, Stats: statsOf(stored)}

	if day.Sessions, err = s.sessions(ctx, userID, weekday, date); err != nil {
		return Day{}, err
	}
	if err := s.planItems(ctx, userID, now, &day); err != nil {
		return Day{}, err
	}
	for _, session := range day.Sessions {
		day.TotalCount++
		if session.Completed {
			day.DoneCount++
		}
	}
	types := make([]string, len(day.PlanItems))
	for i, item := range day.PlanItems {
		types[i] = item.ItemType
		if planitem.Checkable(item.ItemType) {
			day.TotalCount++
			if item.IsCompleted {
				day.DoneCount++
			}
		}
	}
	day.HardCollision = planitem.HasHardCollision(types)

	monday, sunday := dates.WeekRange(now)
	weekLogs, err := s.store.Logs(ctx, userID, monday, sunday)
	if err != nil {
		return Day{}, fmt.Errorf("load week logs: %w", err)
	}
	targets, err := s.store.Quotas(ctx, userID)
	if err != nil {
		return Day{}, fmt.Errorf("load quotas: %w", err)
	}
	day.Quotas = routine.ProgressFor(targets, weekLogs)

	lastPhoto, err := s.store.LastProgressPhotoAt(ctx, userID)
	if err != nil {
		return Day{}, fmt.Errorf("load last progress photo: %w", err)
	}
	day.HasProgressPhoto = lastPhoto != nil
	day.ProgressPhotoDue = progress.IsPhotoDue(stored.CurrentStreak, len(weekLogs), lastPhoto, now)

	if day.Supplements, err = s.supplements(ctx, userID, &day); err != nil {
		return Day{}, err
	}
	return day, nil
}

// supplements marks each stack entry due/taken today. "Training days" follow
// today's sessions and plan items; with no routine and no active plan at all
// they degrade to daily so they never vanish from the checklist.
func (s *Service) supplements(ctx context.Context, userID uuid.UUID, day *Day) ([]Supplement, error) {
	rows, err := s.store.Supplements(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load supplements: %w", err)
	}
	if len(rows) == 0 {
		return []Supplement{}, nil
	}
	takenIDs, err := s.store.TakenSupplementsOn(ctx, userID, day.Date)
	if err != nil {
		return nil, fmt.Errorf("load supplement logs: %w", err)
	}
	hasRoutine, err := s.store.HasAnySchedule(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("check routine: %w", err)
	}
	trainsToday := len(day.Sessions) > 0 || len(day.PlanItems) > 0
	hasStructure := hasRoutine || day.ActivePlans > 0
	today := supplements.Day{Weekday: day.Weekday, IsTrainingDay: trainsToday || !hasStructure}

	taken := make(map[uuid.UUID]bool, len(takenIDs))
	for _, id := range takenIDs {
		taken[id] = true
	}
	list := make([]Supplement, len(rows))
	for i, row := range rows {
		list[i] = Supplement{
			SupplementRow: row, Label: supplements.Label(row.Schedule),
			Due: supplements.IsDue(row.Schedule, today), Taken: taken[row.ID],
		}
	}
	return list, nil
}

func statsOf(p ProfileStats) Stats {
	return Stats{
		XP: p.XP, Level: xp.Level(p.XP), LevelProgress: xp.LevelProgress(p.XP),
		CurrentStreak: p.CurrentStreak, BestStreak: p.BestStreak,
		Hearts: min(max(p.Hearts, 0), streak.MaxHearts),
		Tier:   tiers.FromLeague(&p.LeagueTier),
	}
}

func (s *Service) sessions(ctx context.Context, userID uuid.UUID, weekday int, date string) ([]Session, error) {
	rows, err := s.store.SessionsOn(ctx, userID, weekday, date)
	if err != nil {
		return nil, fmt.Errorf("load today's sessions: %w", err)
	}
	logged, err := s.store.LoggedSportsOn(ctx, userID, date)
	if err != nil {
		return nil, fmt.Errorf("load today's logs: %w", err)
	}
	loggedSport := make(map[int64]bool, len(logged))
	for _, id := range logged {
		loggedSport[id] = true
	}
	sessions := make([]Session, len(rows))
	for i, row := range rows {
		m := xp.Multiplier(row.XPMultiplier)
		sessions[i] = Session{
			SessionRow: row, Multiplier: m, EstimatedXP: workoutXP(m),
			// Completion is per sport and day (logs carry no schedule id):
			// logging one session of a sport completes every one of that sport.
			Completed: row.SportTypeID != nil && loggedSport[*row.SportTypeID],
		}
	}
	return sessions, nil
}

// planItems blends today's items across every active plan; each plan is in
// its own week, counted from its own start.
func (s *Service) planItems(ctx context.Context, userID uuid.UUID, now time.Time, day *Day) error {
	plans, err := s.store.ActivePlans(ctx, userID)
	if err != nil {
		return fmt.Errorf("load active plans: %w", err)
	}
	day.ActivePlans = len(plans)
	weekByPlan := map[uuid.UUID]int{}
	for _, plan := range plans {
		week := dates.PlanWeekForDate(plan.CreatedAt, now)
		if week < 1 || week > plan.WeeksTotal {
			continue
		}
		weekByPlan[plan.ID] = week
		if day.PlanWeek == 0 {
			day.PlanWeek = week
		}
	}
	day.PlanItems = []PlanItem{}
	if len(weekByPlan) == 0 {
		return nil
	}
	rows, err := s.store.PlanItemsOn(ctx, userID, day.Weekday, weekByPlan)
	if err != nil {
		return fmt.Errorf("load today's plan items: %w", err)
	}
	for _, row := range rows {
		day.PlanItems = append(day.PlanItems, PlanItem{PlanItemRow: row, Date: day.Date})
	}
	return nil
}

// workoutXP is round(60 × multiplier) (FORMULAS.md §1).
func workoutXP(multiplier float64) int64 {
	return int64(jsnum.Round(xp.BaseWorkoutXP * multiplier))
}

// LoggedWorkout is the outcome of logging a routine workout.
type LoggedWorkout struct {
	EarnedXP   int64
	Multiplier float64
	TotalXP    int64
}

// LogWorkout records today's workout for a sport and awards its XP. A sport
// can be logged once per day.
func (s *Service) LogWorkout(ctx context.Context, userID uuid.UUID, sportTypeID int64) (LoggedWorkout, error) {
	if sportTypeID <= 0 {
		return LoggedWorkout{}, apperr.New(apperr.Invalid, "Please select a sport type.")
	}
	raw, found, err := s.store.SportMultiplier(ctx, sportTypeID)
	if err != nil {
		return LoggedWorkout{}, fmt.Errorf("load sport: %w", err)
	}
	if !found {
		return LoggedWorkout{}, apperr.New(apperr.Invalid, "Sport type not found.")
	}
	multiplier := xp.Multiplier(raw)
	earned := workoutXP(multiplier)
	date := dates.ToYMD(s.now())
	total, err := s.store.LogWorkout(ctx, userID, NewWorkoutLog{
		SportTypeID: sportTypeID, Date: date, XP: earned,
		Reason: "workout_log:" + strconv.FormatInt(sportTypeID, 10) + ":" + date,
	})
	if errors.Is(err, ErrAlreadyLogged) {
		return LoggedWorkout{}, apperr.New(apperr.Conflict, "Already logged today — nice work.")
	}
	if err != nil {
		return LoggedWorkout{}, fmt.Errorf("log workout: %w", err)
	}
	return LoggedWorkout{EarnedXP: earned, Multiplier: multiplier, TotalXP: total}, nil
}
