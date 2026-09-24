package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	appsupplements "github.com/hamid-karimi/coachin/apps/api/internal/app/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// SupplementStore implements supplements.Store on the coachin_app pool.
type SupplementStore struct {
	*RoutineStore
}

var _ appsupplements.Store = (*SupplementStore)(nil)

// NewSupplementStore wraps a pool connected as coachin_app.
func NewSupplementStore(pool *pgxpool.Pool) *SupplementStore {
	return &SupplementStore{RoutineStore: NewRoutineStore(pool)}
}

// daysParam is the smallint[] column value: NULL unless the schedule is custom.
func daysParam(s supplements.Schedule) []int16 {
	if s.DaysOfWeek == nil {
		return nil
	}
	days := make([]int16, len(s.DaysOfWeek))
	for i, d := range s.DaysOfWeek {
		days[i] = int16(d) // #nosec G115 -- 0..6
	}
	return days
}

// CountSupplements counts the user's stack.
func (s *SupplementStore) CountSupplements(ctx context.Context, userID uuid.UUID) (int, error) {
	var n int32
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		n, err = q.CountSupplements(ctx, userID)
		return err
	})
	return int(n), err
}

// AddSupplement inserts one supplement.
func (s *SupplementStore) AddSupplement(ctx context.Context, userID uuid.UUID, name string, dose *string, schedule supplements.Schedule) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.InsertSupplement(ctx, queries.InsertSupplementParams{
			UserID: userID, Name: name, Dose: dose, ScheduleType: string(schedule.ScheduleType), DaysOfWeek: daysParam(schedule),
		})
	})
}

// UpdateSchedule changes the user's supplement schedule.
func (s *SupplementStore) UpdateSchedule(ctx context.Context, userID, id uuid.UUID, schedule supplements.Schedule) (bool, error) {
	var rows int64
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.UpdateSupplementSchedule(ctx, queries.UpdateSupplementScheduleParams{
			ID: id, UserID: userID, ScheduleType: string(schedule.ScheduleType), DaysOfWeek: daysParam(schedule),
		})
		return err
	})
	return rows > 0, err
}

// DeleteSupplement removes the user's supplement (logs cascade).
func (s *SupplementStore) DeleteSupplement(ctx context.Context, userID, id uuid.UUID) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.DeleteSupplement(ctx, queries.DeleteSupplementParams{ID: id, UserID: userID})
	})
}

// Owns reports whether the supplement is the user's.
func (s *SupplementStore) Owns(ctx context.Context, userID, id uuid.UUID) (bool, error) {
	var owned bool
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		owned, err = q.SupplementOwned(ctx, queries.SupplementOwnedParams{ID: id, UserID: userID})
		return err
	})
	return owned, err
}

// SetTaken adds or removes the day's log.
func (s *SupplementStore) SetTaken(ctx context.Context, userID, id uuid.UUID, date string, taken bool) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		if taken {
			return q.LogSupplementTaken(ctx, queries.LogSupplementTakenParams{UserID: userID, SupplementID: id, OnDate: date})
		}
		return q.UnlogSupplementTaken(ctx, queries.UnlogSupplementTakenParams{UserID: userID, SupplementID: id, OnDate: date})
	})
}
