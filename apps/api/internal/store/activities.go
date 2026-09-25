package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/activities"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// ActivityStore implements activities.ImportStore on the coachin_app pool.
type ActivityStore struct {
	*RoutineStore
}

var _ activities.ImportStore = (*ActivityStore)(nil)

// NewActivityStore wraps a pool connected as coachin_app.
func NewActivityStore(pool *pgxpool.Pool) *ActivityStore {
	return &ActivityStore{RoutineStore: NewRoutineStore(pool)}
}

// ImportRuns resolves the running sport, reads which dates already have a
// completed log of it, and inserts plan's runs with their ledger rows and XP
// — one transaction under the profile lock, so a double submit can't log a
// date twice.
func (s *ActivityStore) ImportRuns(ctx context.Context, userID uuid.UUID, dates []string, plan activities.Plan) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		sport, err := q.RunningSport(ctx)
		if errors.Is(err, pgx.ErrNoRows) {
			return activities.ErrNoRunningSport
		}
		if err != nil {
			return fmt.Errorf("running sport: %w", err)
		}
		existing, err := q.LoggedDatesOf(ctx, queries.LoggedDatesOfParams{UserID: &userID, SportTypeID: &sport.ID, Dates: dates})
		if err != nil {
			return fmt.Errorf("logged dates: %w", err)
		}
		runs, err := plan(activities.RunningSport{ID: sport.ID, Multiplier: float4(sport.XpMultiplier)}, existing)
		if err != nil {
			return err
		}
		var total int64
		for _, run := range runs {
			if err := q.InsertImportedLog(ctx, queries.InsertImportedLogParams{UserID: userID, SportTypeID: sport.ID, OnDate: run.Date, Notes: run.Notes}); err != nil {
				return fmt.Errorf("insert log: %w", err)
			}
			if err := q.InsertXPTransaction(ctx, queries.InsertXPTransactionParams{UserID: userID, Amount: int32(run.XP), Reason: run.Reason}); err != nil { // #nosec G115 -- small award
				return fmt.Errorf("insert xp transaction: %w", err)
			}
			total += run.XP
		}
		_, err = q.AddProfileXP(ctx, queries.AddProfileXPParams{UserID: userID, Amount: int32(total)}) // #nosec G115 -- ≤ 14 runs
		return err
	})
}
