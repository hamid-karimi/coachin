package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

var _ training.GenerationStore = (*TrainingStore)(nil)

// Role reads the user's profile role.
func (s *TrainingStore) Role(ctx context.Context, userID uuid.UUID) (string, error) {
	var role string
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		role, err = q.ProfileRole(ctx, userID)
		return err
	})
	return role, err
}

// Coaches reports an active coach → student relationship.
func (s *TrainingStore) Coaches(ctx context.Context, coachID, studentID uuid.UUID) (bool, error) {
	var ok bool
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		ok, err = q.CoachesStudent(ctx, queries.CoachesStudentParams{CoachID: coachID, StudentID: studentID})
		return err
	})
	return ok, err
}

// Athlete reads the athlete's body profile.
func (s *TrainingStore) Athlete(ctx context.Context, actingID, athleteID uuid.UUID) (training.Athlete, error) {
	var a training.Athlete
	err := s.asUser(ctx, actingID, func(q *queries.Queries) error {
		row, err := q.AthleteProfile(ctx, athleteID)
		if err != nil {
			return err
		}
		a = training.Athlete{
			BirthDate: ymd(row.BirthDate), Sex: row.Sex, HeightCm: numeric(row.HeightCm),
			WeightKg: numeric(row.WeightKg), TrainingHistory: row.TrainingHistory,
			FullName: row.FullName, Email: row.Email,
		}
		return nil
	})
	return a, err
}

// Anchors lists the athlete's fixed sessions active on date.
func (s *TrainingStore) Anchors(ctx context.Context, actingID, athleteID uuid.UUID, date string) ([]aigen.Anchor, error) {
	var rows []queries.ListAnchorsRow
	err := s.asUser(ctx, actingID, func(q *queries.Queries) (err error) {
		rows, err = q.ListAnchors(ctx, queries.ListAnchorsParams{UserID: athleteID, OnDate: date})
		return err
	})
	anchors := make([]aigen.Anchor, len(rows))
	for i, r := range rows {
		sport := "a fixed session"
		if r.SportName != nil {
			sport = *r.SportName
		}
		anchors[i] = aigen.Anchor{DayOfWeek: int(r.DayOfWeek), Time: clockSeconds(r.Time), Sport: sport}
	}
	return anchors, err
}

// CalorieTarget reads the athlete's active calorie goal (row security hides
// other users' goals, so a coach gets nil).
func (s *TrainingStore) CalorieTarget(ctx context.Context, actingID, athleteID uuid.UUID) (*float64, error) {
	var target *float64
	err := s.asUser(ctx, actingID, func(q *queries.Queries) error {
		value, err := q.ActiveCalorieGoal(ctx, athleteID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err == nil {
			target = &value
		}
		return err
	})
	return target, err
}

// BodyAnalysis is the newest body-photo analysis as one line (≤ 500 chars).
func (s *TrainingStore) BodyAnalysis(ctx context.Context, actingID, athleteID uuid.UUID) (*string, error) {
	var notes *string
	err := s.asUser(ctx, actingID, func(q *queries.Queries) error {
		raw, err := q.LatestBodyAnalysis(ctx, athleteID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		var analysis struct {
			BuildNotes   string `json:"build_notes"`
			PostureNotes string `json:"posture_notes"`
		}
		if json.Unmarshal(raw, &analysis) != nil {
			return nil
		}
		var parts []string
		for _, p := range []string{analysis.BuildNotes, analysis.PostureNotes} {
			if p != "" {
				parts = append(parts, p)
			}
		}
		if line := jsnum.Slice(strings.Join(parts, " "), 500); line != "" {
			notes = &line
		}
		return nil
	})
	return notes, err
}

// planResult is create_training_plan's jsonb answer.
type planResult struct {
	Success bool      `json:"success"`
	PlanID  uuid.UUID `json:"plan_id"`
	Error   string    `json:"error"`
}

// CreatePlan saves a generated plan via create_training_plan (ADR-5 Step A).
func (s *TrainingStore) CreatePlan(ctx context.Context, actingID uuid.UUID, plan training.NewPlan) (uuid.UUID, error) {
	items, err := json.Marshal(plan.Items)
	if err != nil {
		return uuid.Nil, err
	}
	var result planResult
	err = s.asUser(ctx, actingID, func(q *queries.Queries) error {
		raw, err := q.CreateTrainingPlan(ctx, queries.CreateTrainingPlanParams{
			RaceDate: plan.RaceDate, GoalTime: plan.GoalTime, WeeksTotal: int32(plan.WeeksTotal), // #nosec G115 -- 4..24
			Summary: plan.Summary, Intake: plan.Intake, Raw: plan.Raw, Model: plan.Model, Items: items,
			PlanKind: plan.PlanKind, TargetUserID: plan.Target,
		})
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(raw), &result)
	})
	if err != nil {
		return uuid.Nil, err
	}
	if !result.Success {
		return uuid.Nil, fmt.Errorf("create_training_plan: %s", result.Error)
	}
	return result.PlanID, nil
}

// numeric converts a nullable numeric column.
func numeric(n pgtype.Numeric) *float64 {
	if !n.Valid {
		return nil
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	return &f.Float64
}

// clockSeconds formats a Postgres time as HH:MM:SS (the stored shape).
func clockSeconds(t pgtype.Time) *string {
	if !t.Valid {
		return nil
	}
	seconds := t.Microseconds / 1_000_000
	s := fmt.Sprintf("%02d:%02d:%02d", seconds/3600, seconds/60%60, seconds%60)
	return &s
}
