package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/calendar"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// CalendarStore implements calendar.Store on the coachin_app pool.
type CalendarStore struct {
	*TodayStore
}

var _ calendar.Store = (*CalendarStore)(nil)

// NewCalendarStore wraps a pool connected as coachin_app.
func NewCalendarStore(pool *pgxpool.Pool) *CalendarStore {
	return &CalendarStore{TodayStore: NewTodayStore(pool)}
}

// SchedulesBetween lists the fixed sessions active at some point from..to.
func (s *CalendarStore) SchedulesBetween(ctx context.Context, userID uuid.UUID, from, to string) ([]calendar.Schedule, error) {
	var rows []queries.ListSchedulesBetweenRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListSchedulesBetween(ctx, queries.ListSchedulesBetweenParams{UserID: userID, FromDate: from, ToDate: to})
		return err
	})
	schedules := make([]calendar.Schedule, len(rows))
	for i, r := range rows {
		schedules[i] = calendar.Schedule{
			SportTypeID: r.SportTypeID, SportName: r.SportName, DayOfWeek: int(r.DayOfWeek),
			Time: clock(r.Time), StartsOn: ymd(r.StartsOn), EndsOn: ymd(r.EndsOn),
		}
	}
	return schedules, err
}

// PlanItemsInWeeks lists every item of each plan's week.
func (s *CalendarStore) PlanItemsInWeeks(ctx context.Context, userID uuid.UUID, weekByPlan map[uuid.UUID]int) ([]calendar.PlanItem, error) {
	params := queries.ListPlanItemsInWeeksParams{UserID: userID}
	for id, week := range weekByPlan {
		params.PlanIds = append(params.PlanIds, id)
		params.Weeks = append(params.Weeks, int32(week)) // #nosec G115 -- plan weeks ≤ 24
	}
	var rows []queries.ListPlanItemsInWeeksRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListPlanItemsInWeeks(ctx, params)
		return err
	})
	items := make([]calendar.PlanItem, len(rows))
	for i, r := range rows {
		items[i] = calendar.PlanItem{
			PlanItem: routine.PlanItem{
				ID: r.ID, DayOfWeek: int(r.DayOfWeek), ItemType: r.ItemType, Title: r.Title,
				Description: r.Description, IsCompleted: r.IsCompleted, Details: planitem.ParseDetails(r.Details),
			},
			PlanID: r.PlanID, Week: int(r.Week),
		}
	}
	return items, err
}
