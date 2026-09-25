// Package calendar places the recurring routine, every active plan, and the
// logged workouts of one Monday–Sunday week on real dates.
package calendar

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
)

// Schedule is a fixed weekly session with its active window.
type Schedule struct {
	SportTypeID *int64
	SportName   *string
	DayOfWeek   int     // 0=Sun … 6=Sat
	Time        *string // HH:MM
	StartsOn    *string // YYYY-MM-DD
	EndsOn      *string
}

// PlanItem is a plan item with its plan and week.
type PlanItem struct {
	routine.PlanItem
	PlanID uuid.UUID
	Week   int
}

// Store is the persistence the calendar needs; every method runs as the user.
type Store interface {
	// SchedulesBetween returns the sessions active at some point from..to.
	SchedulesBetween(ctx context.Context, userID uuid.UUID, from, to string) ([]Schedule, error)
	ActivePlans(ctx context.Context, userID uuid.UUID) ([]routine.Plan, error)
	// PlanItemsInWeeks returns every item of each plan's given week.
	PlanItemsInWeeks(ctx context.Context, userID uuid.UUID, weekByPlan map[uuid.UUID]int) ([]PlanItem, error)
	Logs(ctx context.Context, userID uuid.UUID, from, to string) ([]quotas.Log, error)
	Quotas(ctx context.Context, userID uuid.UUID) ([]routine.Quota, error)
	// MealPlanWeek is the active meal plan's menu by weekday; ok is false without a plan.
	MealPlanWeek(ctx context.Context, userID uuid.UUID) (menu map[int][]nutrition.MealSlot, ok bool, err error)
	// MealSlots are the logged meals dated from..to, by date.
	MealSlots(ctx context.Context, userID uuid.UUID, from, to string) (map[string][]nutrition.MealSlot, error)
}

// DayMeals is a day's planned menu and, up to today, how the logs matched it.
type DayMeals struct {
	PlannedCount int
	PlannedKcal  float64
	Adherence    *nutrition.Adherence // nil on future days
}

// Service builds calendar weeks. now is injectable for tests.
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

// Routine is a fixed session on a day.
type Routine struct {
	SportTypeID *int64
	SportName   *string
	Time        *string
	Done        bool // a completed log of the sport that day
}

// Day is one calendar cell.
type Day struct {
	Date          string // YYYY-MM-DD
	Weekday       int    // 0=Sun … 6=Sat
	IsToday       bool
	Logged        bool // any completed log that day
	Routines      []Routine
	PlanItems     []routine.PlanItem // blended across active plans
	HardCollision bool
	Meals         *DayMeals // nil without an active meal plan or a planned meal that weekday
}

// Week is the calendar page.
type Week struct {
	Monday, Sunday     string
	PrevWeek, NextWeek string // their Mondays
	Today              string
	IsCurrentWeek      bool
	Quotas             []routine.QuotaProgress // the viewed week's progress
	Days               []Day
}

// Week loads the Monday–Sunday week containing anchor (YYYY-MM-DD); a missing
// or malformed anchor means this week.
func (s *Service) Week(ctx context.Context, userID uuid.UUID, anchor string) (Week, error) {
	now := s.now()
	day, err := time.ParseInLocation(dates.YMDLayout, anchor, now.Location())
	if err != nil {
		day = now
	}
	monday := dates.MondayOf(day)
	days := make([]time.Time, 7)
	for i := range days {
		days[i] = monday.AddDate(0, 0, i)
	}
	week := Week{
		Monday: dates.ToYMD(days[0]), Sunday: dates.ToYMD(days[6]),
		PrevWeek: dates.ToYMD(monday.AddDate(0, 0, -7)), NextWeek: dates.ToYMD(monday.AddDate(0, 0, 7)),
		Today: dates.ToYMD(now),
	}
	week.IsCurrentWeek = week.Monday == dates.ToYMD(dates.MondayOf(now))

	schedules, err := s.store.SchedulesBetween(ctx, userID, week.Monday, week.Sunday)
	if err != nil {
		return Week{}, fmt.Errorf("load schedules: %w", err)
	}
	logs, err := s.store.Logs(ctx, userID, week.Monday, week.Sunday)
	if err != nil {
		return Week{}, fmt.Errorf("load week logs: %w", err)
	}
	stored, err := s.store.Quotas(ctx, userID)
	if err != nil {
		return Week{}, fmt.Errorf("load quotas: %w", err)
	}
	week.Quotas = routine.ProgressFor(stored, logs)
	itemsByDate, err := s.planItems(ctx, userID, monday, days)
	if err != nil {
		return Week{}, err
	}

	meals, err := s.meals(ctx, userID, week)
	if err != nil {
		return Week{}, err
	}

	doneSports, logged := completedByDate(logs)
	week.Days = make([]Day, len(days))
	for i, date := range days {
		ymd := dates.ToYMD(date)
		cell := Day{
			Date: ymd, Weekday: int(date.Weekday()), IsToday: ymd == week.Today, Logged: logged[ymd],
			Routines: []Routine{}, PlanItems: itemsByDate[ymd],
		}
		for _, sch := range schedules {
			if sch.DayOfWeek != cell.Weekday || !within(ymd, sch.StartsOn, sch.EndsOn) {
				continue
			}
			done := sch.SportTypeID != nil && doneSports[ymd][*sch.SportTypeID]
			cell.Routines = append(cell.Routines, Routine{SportTypeID: sch.SportTypeID, SportName: sch.SportName, Time: sch.Time, Done: done})
		}
		types := make([]string, len(cell.PlanItems))
		for j, item := range cell.PlanItems {
			types[j] = item.ItemType
		}
		cell.HardCollision = planitem.HasHardCollision(types)
		cell.Meals = meals(cell)
		week.Days[i] = cell
	}
	return week, nil
}

// planItems maps each date to its items across every active plan. Plan weeks
// and calendar weeks both start on Monday, so each plan is in one week here.
func (s *Service) planItems(ctx context.Context, userID uuid.UUID, monday time.Time, days []time.Time) (map[string][]routine.PlanItem, error) {
	byDate := make(map[string][]routine.PlanItem, len(days))
	for _, d := range days {
		byDate[dates.ToYMD(d)] = []routine.PlanItem{}
	}
	plans, err := s.store.ActivePlans(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load active plans: %w", err)
	}
	weekByPlan := map[uuid.UUID]int{}
	for _, plan := range plans {
		if w := dates.PlanWeekForDate(plan.CreatedAt, monday); w >= 1 && w <= plan.WeeksTotal {
			weekByPlan[plan.ID] = w
		}
	}
	if len(weekByPlan) == 0 {
		return byDate, nil
	}
	items, err := s.store.PlanItemsInWeeks(ctx, userID, weekByPlan)
	if err != nil {
		return nil, fmt.Errorf("load plan items: %w", err)
	}
	dateOf := make(map[int]string, len(days))
	for _, d := range days {
		dateOf[int(d.Weekday())] = dates.ToYMD(d)
	}
	for _, item := range items {
		ymd := dateOf[item.DayOfWeek]
		byDate[ymd] = append(byDate[ymd], item.PlanItem)
	}
	return byDate, nil
}

// meals returns the per-day meal summary builder: a no-op without an active
// meal plan (logged meals are only read when there is one).
func (s *Service) meals(ctx context.Context, userID uuid.UUID, week Week) (func(Day) *DayMeals, error) {
	none := func(Day) *DayMeals { return nil }
	menu, ok, err := s.store.MealPlanWeek(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("load meal plan: %w", err)
	}
	if !ok {
		return none, nil
	}
	logged, err := s.store.MealSlots(ctx, userID, week.Monday, week.Sunday)
	if err != nil {
		return nil, fmt.Errorf("load meal logs: %w", err)
	}
	return func(day Day) *DayMeals {
		planned := menu[day.Weekday]
		if len(planned) == 0 {
			return nil
		}
		meals := &DayMeals{PlannedCount: len(planned)}
		for _, meal := range planned {
			meals.PlannedKcal += meal.Kcal
		}
		if day.Date <= week.Today {
			adherence := nutrition.AdherenceForDay(planned, logged[day.Date])
			meals.Adherence = &adherence
		}
		return meals
	}, nil
}

// completedByDate indexes the week's completed logs: sports per date, and
// whether a date has any.
func completedByDate(logs []quotas.Log) (map[string]map[int64]bool, map[string]bool) {
	sports, logged := map[string]map[int64]bool{}, map[string]bool{}
	for _, log := range logs {
		if log.Status != "completed" {
			continue
		}
		logged[log.Date] = true
		if log.SportTypeID == nil {
			continue
		}
		if sports[log.Date] == nil {
			sports[log.Date] = map[int64]bool{}
		}
		sports[log.Date][*log.SportTypeID] = true
	}
	return sports, logged
}

// within reports start ≤ date ≤ end, open-ended when a bound is missing.
func within(date string, start, end *string) bool {
	return (start == nil || date >= *start) && (end == nil || date <= *end)
}
