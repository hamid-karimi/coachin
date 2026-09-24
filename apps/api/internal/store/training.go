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
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
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

var _ training.ProgramStore = (*TrainingStore)(nil)

// programIntake is the part of training_plans.intake the programs page reads.
type programIntake struct {
	RaceTarget     *string  `json:"race_target"`
	RaceDistanceKm *float64 `json:"race_distance_km"`
}

// ActivePrograms lists the user's active plans by plan kind (legacy order).
func (s *TrainingStore) ActivePrograms(ctx context.Context, userID uuid.UUID) ([]training.ProgramRow, error) {
	var rows []queries.ListActiveProgramsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListActivePrograms(ctx, userID)
		return err
	})
	programs := make([]training.ProgramRow, len(rows))
	for i, r := range rows {
		var intake programIntake
		_ = json.Unmarshal(r.Intake, &intake) // a malformed intake only loses the title hints
		programs[i] = training.ProgramRow{
			ID: r.ID, RaceDate: ymd(r.RaceDate), GoalTime: r.GoalTime, WeeksTotal: int(r.WeeksTotal),
			CreatedAt: r.CreatedAt, PlanKind: r.PlanKind, RaceTarget: intake.RaceTarget,
			RaceDistanceKm: intake.RaceDistanceKm, CreatedBy: r.CreatedBy,
		}
	}
	return programs, err
}

// ReviewedWeeks maps each plan to the weeks already checked in.
func (s *TrainingStore) ReviewedWeeks(ctx context.Context, userID uuid.UUID, planIDs []uuid.UUID) (map[uuid.UUID]map[int]bool, error) {
	var rows []queries.ListReviewedWeeksRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListReviewedWeeks(ctx, queries.ListReviewedWeeksParams{UserID: userID, PlanIds: planIDs})
		return err
	})
	reviewed := map[uuid.UUID]map[int]bool{}
	for _, r := range rows {
		if reviewed[r.PlanID] == nil {
			reviewed[r.PlanID] = map[int]bool{}
		}
		reviewed[r.PlanID][int(r.Week)] = true
	}
	return reviewed, err
}

// ArchivePlan retires the user's active plan (no-op otherwise).
func (s *TrainingStore) ArchivePlan(ctx context.Context, userID, planID uuid.UUID) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		_, err := q.ArchivePlan(ctx, queries.ArchivePlanParams{ID: planID, UserID: userID})
		return err
	})
}

// ActivePlanItems lists every item of the user's active plans.
func (s *TrainingStore) ActivePlanItems(ctx context.Context, userID uuid.UUID) ([]training.ExportItem, error) {
	var rows []queries.ListActivePlanItemsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListActivePlanItems(ctx, userID)
		return err
	})
	items := make([]training.ExportItem, len(rows))
	for i, r := range rows {
		items[i] = training.ExportItem{
			ID: r.ID, Week: int(r.Week), DayOfWeek: int(r.DayOfWeek), ItemType: r.ItemType, Title: r.Title,
			Description: r.Description, Details: planitem.ParseDetails(r.Details), PlanCreatedAt: r.PlanCreatedAt,
		}
	}
	return items, err
}
