package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	appprofile "github.com/hamid-karimi/coachin/apps/api/internal/app/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/goals"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/progress"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// ProfileStore implements the profile use cases' store on the coachin_app pool.
type ProfileStore struct {
	*RoutineStore
}

var _ appprofile.Store = (*ProfileStore)(nil)

// NewProfileStore wraps a pool connected as coachin_app.
func NewProfileStore(pool *pgxpool.Pool) *ProfileStore {
	return &ProfileStore{RoutineStore: NewRoutineStore(pool)}
}

// float8 is a nullable float8 parameter.
func float8(v *float64) pgtype.Float8 {
	if v == nil {
		return pgtype.Float8{}
	}
	return pgtype.Float8{Float64: *v, Valid: true}
}

// Body reads the body profile and settings.
func (s *ProfileStore) Body(ctx context.Context, userID uuid.UUID) (appprofile.Body, error) {
	var row queries.GetBodyProfileRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		row, err = q.GetBodyProfile(ctx, userID)
		return err
	})
	return appprofile.Body{
		BirthDate: ymd(row.BirthDate), Sex: row.Sex, HeightCm: numeric(row.HeightCm),
		TrainingHistory: row.TrainingHistory, Country: row.Country,
		WeightKg: numeric(row.WeightKg), BodyFatPct: numeric(row.BodyFatPct),
		NutritionSharing: row.NutritionSharingEnabled,
	}, err
}

// UpdateBody saves the static body profile.
func (s *ProfileStore) UpdateBody(ctx context.Context, userID uuid.UUID, b appprofile.BodyUpdate) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.UpdateBodyProfile(ctx, queries.UpdateBodyProfileParams{
			UserID: userID, BirthDate: b.BirthDate, Sex: b.Sex, HeightCm: float8(b.HeightCm),
			TrainingHistory: b.TrainingHistory, Country: b.Country,
		})
	})
}

// SetNutritionSharing flips the coach-read flag on the meal tables.
func (s *ProfileStore) SetNutritionSharing(ctx context.Context, userID uuid.UUID, enabled bool) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.SetNutritionSharing(ctx, queries.SetNutritionSharingParams{UserID: userID, Enabled: enabled})
	})
}

// Overview reads the join date, avatar, completed-workout count, recent XP,
// and sport names (for the XP labels).
func (s *ProfileStore) Overview(ctx context.Context, userID uuid.UUID, recent int) (appprofile.OverviewRow, error) {
	var out appprofile.OverviewRow
	sports, err := s.SportTypes(ctx)
	if err != nil {
		return out, err
	}
	out.SportNames = make(map[int64]string, len(sports))
	for _, sport := range sports {
		out.SportNames[sport.ID] = sport.Name
	}
	err = s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.ProfileOverview(ctx, userID)
		if err != nil {
			return fmt.Errorf("overview: %w", err)
		}
		out.JoinedAt, out.AvatarURL, out.WorkoutCount = row.JoinedAt, row.AvatarUrl, int(row.WorkoutCount)
		rows, err := q.RecentXP(ctx, queries.RecentXPParams{UserID: &userID, MaxRows: int32(recent)}) // #nosec G115 -- small constant
		if err != nil {
			return fmt.Errorf("recent xp: %w", err)
		}
		out.RecentXP = make([]appprofile.XPRow, len(rows))
		for i, r := range rows {
			out.RecentXP[i] = appprofile.XPRow{ID: r.ID, Amount: int(r.Amount), Reason: r.Reason}
			if r.CreatedAt != nil {
				out.RecentXP[i].CreatedAt = *r.CreatedAt
			}
		}
		return nil
	})
	return out, err
}

// Measurements lists the newest readings.
func (s *ProfileStore) Measurements(ctx context.Context, userID uuid.UUID, limit int) ([]appprofile.Measurement, error) {
	var rows []queries.ListMeasurementsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListMeasurements(ctx, queries.ListMeasurementsParams{UserID: userID, MaxRows: int32(limit)}) // #nosec G115 -- small constant
		return err
	})
	out := make([]appprofile.Measurement, len(rows))
	for i, r := range rows {
		out[i] = appprofile.Measurement{ID: r.ID, MeasuredAt: r.MeasuredAt, WeightKg: numeric(r.WeightKg), BodyFatPct: numeric(r.BodyFatPct)}
	}
	return out, err
}

// SessionLogsSince reads the chart inputs, oldest first.
func (s *ProfileStore) SessionLogsSince(ctx context.Context, userID uuid.UUID, since time.Time) ([]progress.SessionLog, error) {
	var rows []queries.ListSessionLogsSinceRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListSessionLogsSince(ctx, queries.ListSessionLogsSinceParams{UserID: userID, Since: since})
		return err
	})
	if err != nil {
		return nil, err
	}
	logs := make([]progress.SessionLog, len(rows))
	for i, r := range rows {
		logs[i] = progress.SessionLog{CreatedAt: r.CreatedAt, Sport: r.Sport}
		if err := json.Unmarshal(r.Actual, &logs[i].Actual); err != nil {
			return nil, fmt.Errorf("session log actual: %w", err)
		}
	}
	return logs, nil
}

// goalResult is achieve_goal's answer.
type goalResult struct {
	Success bool   `json:"success"`
	Status  string `json:"status"`
	Error   string `json:"error"`
}

func (r *goalResult) failure() string {
	if r.Success {
		return ""
	}
	return "achieve_goal: " + r.Error
}

// AddMeasurement inserts the reading, refreshes the snapshot, and settles
// the active measurement goals (locked) in one transaction.
func (s *ProfileStore) AddMeasurement(ctx context.Context, userID uuid.UUID, weightKg, bodyFatPct *float64, decide appprofile.Decide) ([]appprofile.AchievedGoal, error) {
	achieved := []appprofile.AchievedGoal{}
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.InsertMeasurement(ctx, queries.InsertMeasurementParams{UserID: userID, WeightKg: float8(weightKg), BodyFatPct: float8(bodyFatPct)}); err != nil {
			return fmt.Errorf("insert measurement: %w", err)
		}
		if err := q.RefreshMeasurementSnapshot(ctx, queries.RefreshMeasurementSnapshotParams{UserID: userID, WeightKg: float8(weightKg), BodyFatPct: float8(bodyFatPct)}); err != nil {
			return fmt.Errorf("refresh snapshot: %w", err)
		}
		rows, err := q.LockActiveMeasurementGoals(ctx, userID)
		if err != nil {
			return fmt.Errorf("lock goals: %w", err)
		}
		for _, r := range rows {
			g := appprofile.Goal{ID: r.ID, Type: goals.Type(r.GoalType), Start: numeric(r.StartValue)}
			if target := numeric(r.TargetValue); target != nil {
				g.Target = *target
			}
			if err := settle(ctx, q, userID, g, decide(g), &achieved); err != nil {
				return err
			}
		}
		return nil
	})
	return achieved, err
}

// settle applies one goal's settlement.
func settle(ctx context.Context, q *queries.Queries, userID uuid.UUID, g appprofile.Goal, d appprofile.Decision, achieved *[]appprofile.AchievedGoal) error {
	if d.Outcome == goals.SetBaseline {
		return q.SetGoalStart(ctx, queries.SetGoalStartParams{StartValue: d.Reading, ID: g.ID, UserID: userID})
	}
	if d.Outcome != goals.Achieve {
		return nil
	}
	raw, err := q.AchieveGoal(ctx, g.ID)
	var result goalResult
	if err := decodeRPC(raw, err, &result); err != nil {
		return err
	}
	if result.Status == "achieved" {
		*achieved = append(*achieved, appprofile.AchievedGoal{Type: g.Type, Target: g.Target})
	}
	return nil
}

// DeleteMeasurement removes one of the user's readings.
func (s *ProfileStore) DeleteMeasurement(ctx context.Context, userID, id uuid.UUID) (bool, error) {
	var n int64
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		n, err = q.DeleteMeasurement(ctx, queries.DeleteMeasurementParams{ID: id, UserID: userID})
		return err
	})
	return n > 0, err
}

// Goals lists every goal, newest first.
func (s *ProfileStore) Goals(ctx context.Context, userID uuid.UUID) ([]appprofile.Goal, error) {
	var rows []queries.ListGoalsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListGoals(ctx, userID)
		return err
	})
	out := make([]appprofile.Goal, len(rows))
	for i, r := range rows {
		out[i] = appprofile.Goal{
			ID: r.ID, Type: goals.Type(r.GoalType), Start: numeric(r.StartValue), TargetDate: ymd(r.TargetDate),
			Status: r.Status, AchievedAt: r.AchievedAt, CreatedAt: r.CreatedAt,
		}
		if target := numeric(r.TargetValue); target != nil {
			out[i].Target = *target
		}
	}
	return out, err
}

// GoalValues reads the latest weight / body fat and the kcal logged today.
func (s *ProfileStore) GoalValues(ctx context.Context, userID uuid.UUID, today string) (appprofile.Values, error) {
	var v appprofile.Values
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		latest, err := q.LatestMeasurementValues(ctx, userID)
		if err != nil {
			return fmt.Errorf("latest measurement: %w", err)
		}
		kcal, err := q.KcalOn(ctx, queries.KcalOnParams{UserID: userID, OnDate: today})
		if err != nil {
			return fmt.Errorf("kcal today: %w", err)
		}
		v = appprofile.Values{WeightKg: numeric(latest.WeightKg), BodyFatPct: numeric(latest.BodyFatPct), TodayKcal: &kcal}
		return nil
	})
	return v, err
}

// CreateGoal inserts an active goal; the one-active-per-type index turns a
// duplicate into a Conflict.
func (s *ProfileStore) CreateGoal(ctx context.Context, userID uuid.UUID, g appprofile.Goal) error {
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		return q.InsertGoal(ctx, queries.InsertGoalParams{
			UserID: userID, GoalType: string(g.Type), TargetValue: g.Target, StartValue: float8(g.Start), TargetDate: g.TargetDate,
		})
	})
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
		return apperr.New(apperr.Conflict, appprofile.DuplicateGoalMessage(g.Type))
	}
	return err
}

// AbandonGoal stops an active goal.
func (s *ProfileStore) AbandonGoal(ctx context.Context, userID, id uuid.UUID) (bool, error) {
	var n int64
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		n, err = q.AbandonGoal(ctx, queries.AbandonGoalParams{ID: id, UserID: userID})
		return err
	})
	return n > 0, err
}
