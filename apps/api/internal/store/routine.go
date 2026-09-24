package store

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// RoutineStore implements routine.Store on the coachin_app pool.
type RoutineStore struct {
	pool *pgxpool.Pool
}

var _ routine.Store = (*RoutineStore)(nil)

// NewRoutineStore wraps a pool connected as coachin_app.
func NewRoutineStore(pool *pgxpool.Pool) *RoutineStore {
	return &RoutineStore{pool: pool}
}

// asUser runs fn with the user's row-level-security context.
func (s *RoutineStore) asUser(ctx context.Context, userID uuid.UUID, fn func(*queries.Queries) error) error {
	return WithUser(ctx, s.pool, userID, func(tx pgx.Tx) error { return fn(queries.New(tx)) })
}

// SportTypes lists the named sports (reference data, readable by everyone).
func (s *RoutineStore) SportTypes(ctx context.Context) ([]routine.SportType, error) {
	rows, err := queries.New(s.pool).ListSportTypes(ctx)
	if err != nil {
		return nil, err
	}
	sports := make([]routine.SportType, len(rows))
	for i, r := range rows {
		sports[i] = routine.SportType{ID: r.ID, Name: deref(r.Name), XPMultiplier: float4(r.XpMultiplier)}
	}
	return sports, nil
}

// SportTypeExists reports whether the sport id is known.
func (s *RoutineStore) SportTypeExists(ctx context.Context, id int64) (bool, error) {
	return queries.New(s.pool).SportTypeExists(ctx, id)
}

// Schedules lists the user's fixed sessions by weekday and time.
func (s *RoutineStore) Schedules(ctx context.Context, userID uuid.UUID) ([]routine.Schedule, error) {
	var rows []queries.ListSchedulesRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListSchedules(ctx, userID)
		return err
	})
	schedules := make([]routine.Schedule, len(rows))
	for i, r := range rows {
		schedules[i] = routine.Schedule{
			ID: r.ID, SportTypeID: r.SportTypeID, SportName: r.SportName, DayOfWeek: int(r.DayOfWeek),
			Time: clock(r.Time), EndsOn: ymd(r.EndsOn), XPMultiplier: float4(r.XpMultiplier),
		}
	}
	return schedules, err
}

// AddSchedules inserts every row in one transaction.
func (s *RoutineStore) AddSchedules(ctx context.Context, userID uuid.UUID, rows []profile.ScheduleRow) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		for _, r := range rows {
			err := q.InsertSchedule(ctx, queries.InsertScheduleParams{
				UserID: userID, SportTypeID: r.SportTypeID, DayOfWeek: int16(r.DayOfWeek), // #nosec G115 -- 0..6
				Time: r.Time, EndsOn: r.EndsOn,
			})
			if err != nil {
				return fmt.Errorf("insert schedule: %w", err)
			}
		}
		return nil
	})
}

// DeleteSchedule removes the user's session; a missing row is not an error.
func (s *RoutineStore) DeleteSchedule(ctx context.Context, userID, id uuid.UUID) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		_, err := q.DeleteSchedule(ctx, queries.DeleteScheduleParams{ID: id, UserID: userID})
		return err
	})
}

// Quotas lists the user's weekly targets in creation order.
func (s *RoutineStore) Quotas(ctx context.Context, userID uuid.UUID) ([]routine.Quota, error) {
	var rows []queries.ListQuotasRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListQuotas(ctx, userID)
		return err
	})
	list := make([]routine.Quota, len(rows))
	for i, r := range rows {
		list[i] = routine.Quota{ID: r.ID, SportTypeID: r.SportTypeID, SportName: r.SportName, SessionsPerWeek: int(r.SessionsPerWeek)}
	}
	return list, err
}

// SaveQuota upserts on (user, sport).
func (s *RoutineStore) SaveQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64, sessionsPerWeek int) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.UpsertQuota(ctx, queries.UpsertQuotaParams{
			UserID: userID, SportTypeID: sportTypeID, SessionsPerWeek: int32(sessionsPerWeek), // #nosec G115 -- 1..14
		})
	})
}

// DeleteQuota removes the user's target for a sport; none is not an error.
func (s *RoutineStore) DeleteQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		_, err := q.DeleteQuota(ctx, queries.DeleteQuotaParams{SportTypeID: sportTypeID, UserID: userID})
		return err
	})
}

// Logs lists the user's logs dated from..to inclusive.
func (s *RoutineStore) Logs(ctx context.Context, userID uuid.UUID, from, to string) ([]quotas.Log, error) {
	var rows []queries.ListLogsBetweenRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListLogsBetween(ctx, queries.ListLogsBetweenParams{UserID: userID, FromDate: from, ToDate: to})
		return err
	})
	logs := make([]quotas.Log, len(rows))
	for i, r := range rows {
		logs[i] = quotas.Log{SportTypeID: r.SportTypeID, Date: r.Date, Status: r.Status}
	}
	return logs, err
}

// LatestActivePlan returns the user's newest active plan, or nil.
func (s *RoutineStore) LatestActivePlan(ctx context.Context, userID uuid.UUID) (*routine.Plan, error) {
	var plan *routine.Plan
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.LatestActivePlan(ctx, userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		plan = &routine.Plan{ID: row.ID, CreatedAt: row.CreatedAt, WeeksTotal: int(row.WeeksTotal)}
		return nil
	})
	return plan, err
}

// PlanWeekItems lists one week of the user's plan, Sunday-first by weekday.
func (s *RoutineStore) PlanWeekItems(ctx context.Context, userID, planID uuid.UUID, week int) ([]routine.PlanItem, error) {
	var rows []queries.ListPlanWeekItemsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListPlanWeekItems(ctx, queries.ListPlanWeekItemsParams{
			PlanID: planID, UserID: userID, Week: int32(week), // #nosec G115 -- plan weeks ≤ 24
		})
		return err
	})
	items := make([]routine.PlanItem, len(rows))
	for i, r := range rows {
		items[i] = routine.PlanItem{
			ID: r.ID, DayOfWeek: int(r.DayOfWeek), ItemType: r.ItemType, Title: r.Title,
			Description: r.Description, IsCompleted: r.IsCompleted, Details: planitem.ParseDetails(r.Details),
		}
	}
	return items, err
}

// float4 widens a Postgres real without float32 noise: 1.2 stays 1.2, not
// 1.2000000476837158 (the shortest float32 text, re-parsed as float64).
func float4(v *float32) *float64 {
	if v == nil {
		return nil
	}
	f, _ := strconv.ParseFloat(strconv.FormatFloat(float64(*v), 'g', -1, 32), 64)
	return &f
}

// clock formats a Postgres time as HH:MM.
func clock(t pgtype.Time) *string {
	if !t.Valid {
		return nil
	}
	minutes := t.Microseconds / 60_000_000
	s := fmt.Sprintf("%02d:%02d", minutes/60, minutes%60)
	return &s
}

// ymd formats a Postgres date as YYYY-MM-DD.
func ymd(d pgtype.Date) *string {
	if !d.Valid {
		return nil
	}
	s := d.Time.Format(dates.YMDLayout)
	return &s
}
