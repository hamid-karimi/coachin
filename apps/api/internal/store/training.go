package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// TrainingStore implements training.Store on the coachin_app pool.
type TrainingStore struct {
	*RoutineStore
}

var _ training.Store = (*TrainingStore)(nil)

// NewTrainingStore wraps a pool connected as coachin_app.
func NewTrainingStore(pool *pgxpool.Pool) *TrainingStore {
	return &TrainingStore{RoutineStore: NewRoutineStore(pool)}
}

// PlanItem loads the item if it belongs to one of the user's plans.
func (s *TrainingStore) PlanItem(ctx context.Context, userID, itemID uuid.UUID) (training.ItemRef, error) {
	var ref training.ItemRef
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.GetPlanItemRef(ctx, queries.GetPlanItemRefParams{ID: itemID, UserID: userID})
		if errors.Is(err, pgx.ErrNoRows) {
			return training.ErrNotFound
		}
		if err != nil {
			return err
		}
		ref = training.ItemRef{
			ItemType: row.ItemType, Week: int(row.Week), DayOfWeek: int(row.DayOfWeek),
			IsCompleted: row.IsCompleted, PlanCreatedAt: row.PlanCreatedAt,
		}
		return nil
	})
	return ref, err
}

// completionResult is complete_plan_item's jsonb answer.
type completionResult struct {
	Success   bool   `json:"success"`
	AwardedXP int    `json:"awarded_xp"`
	Error     string `json:"error"`
}

// SetPlanItemCompleted calls complete_plan_item (ADR-5 Step A).
func (s *TrainingStore) SetPlanItemCompleted(ctx context.Context, userID, itemID uuid.UUID, completed bool, date string) (int, error) {
	var result completionResult
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		raw, err := q.CompletePlanItem(ctx, queries.CompletePlanItemParams{ItemID: itemID, Completed: completed, OnDate: date})
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(raw), &result)
	})
	if err != nil {
		return 0, err
	}
	if !result.Success {
		return 0, fmt.Errorf("complete_plan_item: %s", result.Error)
	}
	return result.AwardedXP, nil
}
