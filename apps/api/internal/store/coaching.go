package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	appcoaching "github.com/hamid-karimi/coachin/apps/api/internal/app/coaching"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// CoachingStore implements coaching.Store on the coachin_app pool; every
// read runs as the signed-in user, so the coach-read policies apply.
type CoachingStore struct {
	*RoutineStore
}

var _ appcoaching.Store = (*CoachingStore)(nil)

// NewCoachingStore wraps a pool connected as coachin_app.
func NewCoachingStore(pool *pgxpool.Pool) *CoachingStore {
	return &CoachingStore{RoutineStore: NewRoutineStore(pool)}
}

// Role reads the user's profile role.
func (s *CoachingStore) Role(ctx context.Context, userID uuid.UUID) (string, error) {
	var role string
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		role, err = q.UserRole(ctx, userID)
		return err
	})
	return role, err
}

// Trainees lists the coach's active relationships.
func (s *CoachingStore) Trainees(ctx context.Context, coachID uuid.UUID) ([]appcoaching.TraineeRow, error) {
	var rows []queries.ListTraineesRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.ListTrainees(ctx, coachID)
		return err
	})
	out := make([]appcoaching.TraineeRow, len(rows))
	for i, r := range rows {
		out[i] = appcoaching.TraineeRow{
			ID: r.ID, Email: r.Email, FullName: r.FullName, AvatarURL: r.AvatarUrl, XP: r.Xp, Level: r.Level,
			LeagueTier: r.LeagueTier, NutritionShared: r.NutritionSharingEnabled,
		}
		if r.SportTypeID != nil {
			out[i].Sport = &appcoaching.Sport{ID: *r.SportTypeID, Name: deref(r.SportName)}
		}
	}
	return out, err
}

// LoggedDates maps trainees to their completed-log dates in the window.
func (s *CoachingStore) LoggedDates(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID, from, to string) (map[uuid.UUID][]string, error) {
	var rows []queries.TraineeLoggedDatesRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.TraineeLoggedDates(ctx, queries.TraineeLoggedDatesParams{Ids: ids, FromDate: from, ToDate: to})
		return err
	})
	out := map[uuid.UUID][]string{}
	for _, r := range rows {
		if r.UserID != nil {
			out[*r.UserID] = append(out[*r.UserID], r.OnDate)
		}
	}
	return out, err
}

// ScheduledDays maps trainees to their routine's weekdays.
func (s *CoachingStore) ScheduledDays(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID) (map[uuid.UUID][]int, error) {
	var rows []queries.TraineeScheduledDaysRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.TraineeScheduledDays(ctx, ids)
		return err
	})
	out := map[uuid.UUID][]int{}
	for _, r := range rows {
		if r.UserID != nil {
			out[*r.UserID] = append(out[*r.UserID], int(r.DayOfWeek))
		}
	}
	return out, err
}

// ActivePlans lists the trainees' active training plans.
func (s *CoachingStore) ActivePlans(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID) ([]appcoaching.ActivePlan, error) {
	var rows []queries.TraineeActivePlansRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.TraineeActivePlans(ctx, ids)
		return err
	})
	out := make([]appcoaching.ActivePlan, len(rows))
	for i, r := range rows {
		out[i] = appcoaching.ActivePlan{ID: r.ID, UserID: r.UserID, Kind: r.PlanKind, CreatedAt: r.CreatedAt, WeeksTotal: int(r.WeeksTotal)}
	}
	return out, err
}

// PlanItems reads the plans' items in the given weeks.
func (s *CoachingStore) PlanItems(ctx context.Context, coachID uuid.UUID, planIDs []uuid.UUID, weeks []int) ([]appcoaching.PlanWeekItem, error) {
	weeks32 := make([]int32, len(weeks))
	for i, w := range weeks {
		weeks32[i] = int32(w) // #nosec G115 -- plan weeks are small
	}
	var rows []queries.PlanItemsInWeeksRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.PlanItemsInWeeks(ctx, queries.PlanItemsInWeeksParams{PlanIds: planIDs, Weeks: weeks32})
		return err
	})
	if err != nil {
		return nil, err
	}
	out := make([]appcoaching.PlanWeekItem, len(rows))
	for i, r := range rows {
		item := scorecard.Item{ItemType: r.ItemType, IsCompleted: r.IsCompleted}
		if len(r.Details) > 0 {
			if err := json.Unmarshal(r.Details, &item.Details); err != nil {
				return nil, fmt.Errorf("plan item details: %w", err)
			}
		}
		out[i] = appcoaching.PlanWeekItem{PlanID: r.PlanID, Week: int(r.Week), Item: item}
	}
	return out, nil
}

// WeeklyXP reads this week's XP through get_weekly_leaderboard (the ledger
// of other users is not readable), for the given trainees only.
func (s *CoachingStore) WeeklyXP(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]int64, error) {
	out := map[uuid.UUID]int64{}
	err := WithUser(ctx, s.pool, coachID, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, `SELECT id, weekly_xp FROM public.get_weekly_leaderboard($1::uuid[], $2)`, ids, len(ids))
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id uuid.UUID
			var xp int64
			if err := rows.Scan(&id, &xp); err != nil {
				return err
			}
			out[id] = xp
		}
		return rows.Err()
	})
	return out, err
}

// InviteCodes lists the coach's codes, newest first.
func (s *CoachingStore) InviteCodes(ctx context.Context, coachID uuid.UUID) ([]appcoaching.InviteCode, error) {
	var rows []queries.ListInviteCodesRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.ListInviteCodes(ctx, coachID)
		return err
	})
	out := make([]appcoaching.InviteCode, len(rows))
	for i, r := range rows {
		out[i] = appcoaching.InviteCode{Code: r.Code, IsActive: r.IsActive, ExpiresAt: r.ExpiresAt, Sport: &appcoaching.Sport{ID: r.SportTypeID, Name: deref(r.SportName)}}
	}
	return out, err
}

// SportExists checks a sport type id (reference data).
func (s *CoachingStore) SportExists(ctx context.Context, sportTypeID int64) (bool, error) {
	return queries.New(s.pool).SportExists(ctx, sportTypeID)
}

// UpsertInviteCode replaces the coach's code for a sport.
func (s *CoachingStore) UpsertInviteCode(ctx context.Context, coachID uuid.UUID, sportTypeID int64, code string) error {
	return s.asUser(ctx, coachID, func(q *queries.Queries) error {
		return q.UpsertInviteCode(ctx, queries.UpsertInviteCodeParams{CoachID: coachID, SportTypeID: sportTypeID, Code: code})
	})
}

// coachingResult is the join / assign functions' answer.
type coachingResult struct {
	Success bool   `json:"success"`
	Status  string `json:"status"`
	Error   string `json:"error"`
}

// JoinByCode runs join_coaching_via_invite_code.
func (s *CoachingStore) JoinByCode(ctx context.Context, userID uuid.UUID, code string) (string, string, error) {
	var result coachingResult
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		raw, err := q.JoinCoachingByCode(ctx, code)
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(raw), &result)
	})
	return result.Status, result.Error, err
}

// AssignSchedule runs assign_coach_schedule_to_student.
func (s *CoachingStore) AssignSchedule(ctx context.Context, coachID, traineeID uuid.UUID) (string, error) {
	var result coachingResult
	err := s.asUser(ctx, coachID, func(q *queries.Queries) error {
		raw, err := q.AssignCoachSchedule(ctx, traineeID)
		if err != nil {
			return err
		}
		return json.Unmarshal([]byte(raw), &result)
	})
	return result.Error, err
}

var _ appcoaching.NutritionStore = (*CoachingStore)(nil)

// CoachedTrainee finds an actively coached trainee.
func (s *CoachingStore) CoachedTrainee(ctx context.Context, coachID, traineeID uuid.UUID) (appcoaching.CoachedTrainee, bool, error) {
	var row queries.CoachedTraineeRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		row, err = q.CoachedTrainee(ctx, queries.CoachedTraineeParams{CoachID: coachID, TraineeID: traineeID})
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return appcoaching.CoachedTrainee{}, false, nil
	}
	return appcoaching.CoachedTrainee{ID: row.ID, FullName: row.FullName, Email: row.Email, NutritionSharing: row.NutritionSharingEnabled}, err == nil, err
}

// TraineeMeals reads the trainee's meals since from (coach-read policy).
func (s *CoachingStore) TraineeMeals(ctx context.Context, coachID, traineeID uuid.UUID, from string) ([]appcoaching.TraineeMeal, error) {
	var rows []queries.TraineeMealsSinceRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.TraineeMealsSince(ctx, queries.TraineeMealsSinceParams{UserID: traineeID, FromDate: from})
		return err
	})
	out := make([]appcoaching.TraineeMeal, len(rows))
	for i, r := range rows {
		out[i] = appcoaching.TraineeMeal{ID: r.ID, Date: r.OnDate, MealType: r.MealType, Label: r.Label, Kcal: r.Kcal, ProteinG: r.ProteinG}
	}
	return out, err
}

// TraineeTargets reads the active meal plan's targets (nil without one).
func (s *CoachingStore) TraineeTargets(ctx context.Context, coachID, traineeID uuid.UUID) (*appcoaching.MealTargets, error) {
	var row queries.TraineeMealPlanTargetsRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		row, err = q.TraineeMealPlanTargets(ctx, traineeID)
		return err
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &appcoaching.MealTargets{Kcal: row.Kcal, ProteinG: row.ProteinG}, nil
}

// TraineeSupplements reads the trainee's stack.
func (s *CoachingStore) TraineeSupplements(ctx context.Context, coachID, traineeID uuid.UUID) ([]appcoaching.TraineeSupplement, error) {
	var rows []queries.TraineeSupplementsRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.TraineeSupplements(ctx, traineeID)
		return err
	})
	out := make([]appcoaching.TraineeSupplement, len(rows))
	for i, r := range rows {
		days := make([]int, len(r.DaysOfWeek))
		for j, d := range r.DaysOfWeek {
			days[j] = int(d)
		}
		out[i] = appcoaching.TraineeSupplement{
			ID: r.ID, Name: r.Name, Dose: r.Dose, Schedule: supplements.Normalize(r.ScheduleType, days),
			CreatedYMD: dates.ToYMD(r.CreatedAt.Local()),
		}
	}
	return out, err
}

// TraineeTakenDates maps supplements to the dates they were taken.
func (s *CoachingStore) TraineeTakenDates(ctx context.Context, coachID, traineeID uuid.UUID, from string) (map[uuid.UUID]map[string]bool, error) {
	var rows []queries.TraineeSupplementLogsSinceRow
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		rows, err = q.TraineeSupplementLogsSince(ctx, queries.TraineeSupplementLogsSinceParams{UserID: traineeID, FromDate: from})
		return err
	})
	out := map[uuid.UUID]map[string]bool{}
	for _, r := range rows {
		if out[r.SupplementID] == nil {
			out[r.SupplementID] = map[string]bool{}
		}
		out[r.SupplementID][r.OnDate] = true
	}
	return out, err
}

// TraineeTrainingDays reads active plan items and routine days.
func (s *CoachingStore) TraineeTrainingDays(ctx context.Context, coachID, traineeID uuid.UUID) ([]supplements.PlanDay, []supplements.RoutineDay, error) {
	var (
		items   []queries.TraineeTrainingDaysRow
		routine []queries.TraineeRoutineDaysRow
	)
	err := s.asUser(ctx, coachID, func(q *queries.Queries) (err error) {
		if items, err = q.TraineeTrainingDays(ctx, traineeID); err != nil {
			return err
		}
		routine, err = q.TraineeRoutineDays(ctx, &traineeID)
		return err
	})
	plans := make([]supplements.PlanDay, len(items))
	for i, r := range items {
		plans[i] = supplements.PlanDay{PlanCreatedAt: r.CreatedAt, WeeksTotal: int(r.WeeksTotal), Week: int(r.Week), Weekday: int(r.DayOfWeek)}
	}
	days := make([]supplements.RoutineDay, len(routine))
	for i, r := range routine {
		days[i] = supplements.RoutineDay{Weekday: int(r.DayOfWeek), StartsOn: ymd(r.StartsOn), EndsOn: ymd(r.EndsOn)}
	}
	return plans, days, err
}
