package coaching

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/supplements"
)

// NutritionWindowDays is how far back the coach's view reaches.
const NutritionWindowDays = 7

// CoachedTrainee is an actively coached trainee and their sharing opt-in.
type CoachedTrainee struct {
	ID               uuid.UUID
	FullName, Email  *string
	NutritionSharing bool
}

// TraineeMeal is one logged meal.
type TraineeMeal struct {
	ID       uuid.UUID
	Date     string
	MealType string
	Label    string
	Kcal     float64
	ProteinG float64
}

// MealTargets are the active meal plan's daily targets.
type MealTargets struct {
	Kcal, ProteinG float64
}

// TraineeSupplement is one stack entry with its created date.
type TraineeSupplement struct {
	ID         uuid.UUID
	Name       string
	Dose       *string
	Schedule   supplements.Schedule
	CreatedYMD string
}

// NutritionStore reads a trainee's nutrition as their coach (the
// coach-read RLS policies require the trainee's sharing opt-in).
type NutritionStore interface {
	CoachedTrainee(ctx context.Context, coachID, traineeID uuid.UUID) (CoachedTrainee, bool, error)
	TraineeMeals(ctx context.Context, coachID, traineeID uuid.UUID, from string) ([]TraineeMeal, error)
	TraineeTargets(ctx context.Context, coachID, traineeID uuid.UUID) (*MealTargets, error)
	TraineeSupplements(ctx context.Context, coachID, traineeID uuid.UUID) ([]TraineeSupplement, error)
	// TraineeTakenDates maps supplement ids to the dates they were taken since from.
	TraineeTakenDates(ctx context.Context, coachID, traineeID uuid.UUID, from string) (map[uuid.UUID]map[string]bool, error)
	TraineeTrainingDays(ctx context.Context, coachID, traineeID uuid.UUID) ([]supplements.PlanDay, []supplements.RoutineDay, error)
}

// NutritionDay is one day with meals.
type NutritionDay struct {
	Date          string
	Meals         []TraineeMeal
	TotalKcal     float64
	TotalProteinG float64
}

// SupplementAdherence is a stack entry's last-7-days taken rate.
type SupplementAdherence struct {
	TraineeSupplement
	Label string
	supplements.TakenRate
}

// TraineeNutrition is the coach's read-only view.
type TraineeNutrition struct {
	TraineeID      uuid.UUID
	Name           string
	SharingEnabled bool
	Days           []NutritionDay // newest first, days with meals only
	Targets        *MealTargets
	Supplements    []SupplementAdherence
}

// NutritionService serves the trainee nutrition view.
type NutritionService struct {
	store  Store
	reader NutritionStore
	now    func() time.Time
}

// NewNutritionService builds the service; now defaults to time.Now.
func NewNutritionService(store Store, reader NutritionStore, now func() time.Time) *NutritionService {
	if now == nil {
		now = time.Now
	}
	return &NutritionService{store: store, reader: reader, now: now}
}

// TraineeNutrition reads the last 7 days of a coached trainee's meals and
// supplements. 404 unless actively coached; nothing is read without the
// trainee's sharing opt-in.
func (s *NutritionService) TraineeNutrition(ctx context.Context, coachID, traineeID uuid.UUID) (TraineeNutrition, error) {
	role, err := s.store.Role(ctx, coachID)
	if err != nil {
		return TraineeNutrition{}, fmt.Errorf("read role: %w", err)
	}
	if !CanCoach(role) {
		return TraineeNutrition{}, apperr.New(apperr.Forbidden, "Only coaches can view trainee nutrition.")
	}
	trainee, ok, err := s.reader.CoachedTrainee(ctx, coachID, traineeID)
	if err != nil {
		return TraineeNutrition{}, fmt.Errorf("find trainee: %w", err)
	}
	if !ok {
		return TraineeNutrition{}, apperr.New(apperr.NotFound, "Trainee not found")
	}
	out := TraineeNutrition{TraineeID: trainee.ID, Name: displayName(trainee.FullName, trainee.Email), SharingEnabled: trainee.NutritionSharing,
		Days: []NutritionDay{}, Supplements: []SupplementAdherence{}}
	if !trainee.NutritionSharing {
		return out, nil
	}
	now := s.now()
	from := dates.ToYMD(now.AddDate(0, 0, -(NutritionWindowDays - 1)))
	meals, err := s.reader.TraineeMeals(ctx, coachID, traineeID, from)
	if err != nil {
		return TraineeNutrition{}, fmt.Errorf("meals: %w", err)
	}
	out.Days = groupByDay(meals)
	if out.Targets, err = s.reader.TraineeTargets(ctx, coachID, traineeID); err != nil {
		return TraineeNutrition{}, fmt.Errorf("targets: %w", err)
	}
	if out.Supplements, err = s.supplements(ctx, coachID, traineeID, now, from); err != nil {
		return TraineeNutrition{}, err
	}
	return out, nil
}

func displayName(fullName, email *string) string {
	for _, s := range []*string{fullName, email} {
		if s != nil && *s != "" {
			return *s
		}
	}
	return "Trainee"
}

// groupByDay keeps the meals' order (newest day first, logging order within).
func groupByDay(meals []TraineeMeal) []NutritionDay {
	days := []NutritionDay{}
	for _, m := range meals {
		i := slices.IndexFunc(days, func(d NutritionDay) bool { return d.Date == m.Date })
		if i < 0 {
			days = append(days, NutritionDay{Date: m.Date})
			i = len(days) - 1
		}
		days[i].Meals = append(days[i].Meals, m)
		days[i].TotalKcal += m.Kcal
		days[i].TotalProteinG += m.ProteinG
	}
	return days
}

func (s *NutritionService) supplements(ctx context.Context, coachID, traineeID uuid.UUID, now time.Time, from string) ([]SupplementAdherence, error) {
	stack, err := s.reader.TraineeSupplements(ctx, coachID, traineeID)
	if err != nil || len(stack) == 0 {
		return []SupplementAdherence{}, err
	}
	taken, err := s.reader.TraineeTakenDates(ctx, coachID, traineeID, from)
	if err != nil {
		return nil, fmt.Errorf("supplement logs: %w", err)
	}
	plans, routine, err := s.reader.TraineeTrainingDays(ctx, coachID, traineeID)
	if err != nil {
		return nil, fmt.Errorf("training days: %w", err)
	}
	window := supplements.Window(now, NutritionWindowDays, plans, routine)
	out := make([]SupplementAdherence, len(stack))
	for i, sup := range stack {
		out[i] = SupplementAdherence{
			TraineeSupplement: sup, Label: supplements.Label(sup.Schedule),
			TakenRate: supplements.TakenRateOver(sup.Schedule, sup.CreatedYMD, window, taken[sup.ID]),
		}
	}
	return out, nil
}
