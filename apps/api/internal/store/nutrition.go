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
	"github.com/jackc/pgx/v5/pgxpool"

	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/store/queries"
)

// NutritionStore implements the nutrition use cases' store on the coachin_app pool.
type NutritionStore struct {
	*RoutineStore
}

var _ appnutrition.Store = (*NutritionStore)(nil)

// NewNutritionStore wraps a pool connected as coachin_app.
func NewNutritionStore(pool *pgxpool.Pool) *NutritionStore {
	return &NutritionStore{RoutineStore: NewRoutineStore(pool)}
}

// Meals lists the user's meals on a date, in logging order.
func (s *NutritionStore) Meals(ctx context.Context, userID uuid.UUID, date string) ([]appnutrition.Meal, error) {
	var rows []queries.ListMealsOnRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListMealsOn(ctx, queries.ListMealsOnParams{UserID: userID, OnDate: date})
		return err
	})
	meals := make([]appnutrition.Meal, len(rows))
	for i, r := range rows {
		meals[i] = appnutrition.Meal{
			ID: r.ID, MealType: r.MealType, Name: r.FreeText, QuantityG: numeric(r.QuantityG), EntryMethod: r.EntryMethod,
			Nutrients: nutrition.Nutrients{
				Kcal: r.Kcal, ProteinG: r.ProteinG, CarbsG: r.CarbsG, FatG: r.FatG, SugarG: r.SugarG, FiberG: r.FiberG, SodiumMg: r.SodiumMg,
			},
		}
	}
	return meals, err
}

// CalorieTarget is the active calorie_intake goal's target.
func (s *NutritionStore) CalorieTarget(ctx context.Context, userID uuid.UUID) (*float64, error) {
	var target *float64
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		v, err := q.ActiveCalorieGoal(ctx, userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err == nil {
			target = &v
		}
		return err
	})
	return target, err
}

// NutrientsSince lists every meal's nutrients dated from on.
func (s *NutritionStore) NutrientsSince(ctx context.Context, userID uuid.UUID, from string) ([]nutrition.DatedNutrients, error) {
	var rows []queries.ListMealNutrientsSinceRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.ListMealNutrientsSince(ctx, queries.ListMealNutrientsSinceParams{UserID: userID, FromDate: from})
		return err
	})
	out := make([]nutrition.DatedNutrients, len(rows))
	for i, r := range rows {
		out[i] = nutrition.DatedNutrients{Date: r.Date, Nutrients: nutrition.Nutrients{
			Kcal: r.Kcal, ProteinG: r.ProteinG, CarbsG: r.CarbsG, FatG: r.FatG, SugarG: r.SugarG, FiberG: r.FiberG, SodiumMg: r.SodiumMg,
		}}
	}
	return out, err
}

// likeEscaper makes user text literal inside an ILIKE pattern.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// SearchFoods matches food names containing the query (case-insensitive).
func (s *NutritionStore) SearchFoods(ctx context.Context, userID uuid.UUID, query string) ([]appnutrition.Food, error) {
	var rows []queries.SearchFoodsRow
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		rows, err = q.SearchFoods(ctx, likeEscaper.Replace(query))
		return err
	})
	foods := make([]appnutrition.Food, len(rows))
	for i, r := range rows {
		foods[i] = foodFrom(queries.GetFoodRow(r))
	}
	return foods, err
}

// Food loads one food.
func (s *NutritionStore) Food(ctx context.Context, userID uuid.UUID, id uuid.UUID) (appnutrition.Food, error) {
	var food appnutrition.Food
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.GetFood(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return appnutrition.ErrNotFound
		}
		food = foodFrom(row)
		return err
	})
	return food, err
}

// SaveUSDAFood keeps one row per USDA food and returns it.
func (s *NutritionStore) SaveUSDAFood(ctx context.Context, userID uuid.UUID, f nutrition.USDAFood) (appnutrition.Food, error) {
	var food appnutrition.Food
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		err := q.InsertUSDAFood(ctx, queries.InsertUSDAFoodParams{
			Name: f.Name, Kcal: f.Kcal, ProteinG: f.ProteinG, CarbsG: f.CarbsG, FatG: f.FatG,
			SugarG: f.SugarG, FiberG: f.FiberG, SodiumMg: f.SodiumMg, UserID: userID, FdcID: int32(f.FdcID), // #nosec G115 -- FDC ids fit int32
		})
		if err != nil {
			return err
		}
		row, err := q.GetFoodByFdcID(ctx, int32(f.FdcID)) // #nosec G115 -- as above
		food = foodFrom(queries.GetFoodRow(row))
		return err
	})
	return food, err
}

func foodFrom(r queries.GetFoodRow) appnutrition.Food {
	return appnutrition.Food{ID: r.ID, Name: r.Name, Source: r.Source, Per100g: nutrition.Per100g{
		Kcal: r.KcalPer100g, ProteinG: r.ProteinG, CarbsG: r.CarbsG, FatG: r.FatG, SugarG: r.SugarG, FiberG: r.FiberG, SodiumMg: r.SodiumMg,
	}}
}

// LogMeals stores the meals and their XP (meal_log:<id>, capped per date), and
// settles adherenceDate's calorie-goal bonus (calorie_goal:<date>), in one
// transaction; the profile lock serializes the 3-a-day cap.
func (s *NutritionStore) LogMeals(ctx context.Context, userID uuid.UUID, date, adherenceDate string, meals []appnutrition.NewMeal, rules appnutrition.MealRules) (appnutrition.Awards, error) {
	var awards appnutrition.Awards
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		for _, m := range meals {
			id, err := q.InsertMealLog(ctx, mealParams(userID, date, m))
			if err != nil {
				return fmt.Errorf("insert meal: %w", err)
			}
			awarded, err := q.CountMealAwardsOn(ctx, queries.CountMealAwardsOnParams{UserID: &userID, OnDate: date})
			if err != nil {
				return fmt.Errorf("count meal awards: %w", err)
			}
			xp, capped := rules.Award(int(awarded))
			if err := addXP(ctx, q, userID, xp, "meal_log:"+id.String()); err != nil {
				return err
			}
			awards.MealXP += xp
			awards.Capped = awards.Capped || capped
		}
		bonus, err := calorieDay(ctx, q, userID, adherenceDate, rules.CalorieDay)
		awards.Adherence = bonus
		return err
	})
	return awards, err
}

// calorieDay pays day's calorie-goal bonus once, when rule says it was met.
func calorieDay(ctx context.Context, q *queries.Queries, userID uuid.UUID, day string, rule func(target *float64, kcal float64, meals int) int) (int, error) {
	reason := "calorie_goal:" + day
	paid, err := q.LedgerHasReason(ctx, queries.LedgerHasReasonParams{UserID: &userID, Reason: reason})
	if err != nil || paid {
		return 0, err
	}
	var target *float64
	value, err := q.ActiveCalorieGoal(ctx, userID)
	switch {
	case err == nil:
		target = &value
	case !errors.Is(err, pgx.ErrNoRows):
		return 0, fmt.Errorf("calorie goal: %w", err)
	}
	intake, err := q.DayIntake(ctx, queries.DayIntakeParams{UserID: userID, OnDate: day})
	if err != nil {
		return 0, fmt.Errorf("day intake: %w", err)
	}
	bonus := rule(target, intake.Kcal, int(intake.Meals))
	return bonus, addXP(ctx, q, userID, bonus, reason)
}

func mealParams(userID uuid.UUID, date string, m appnutrition.NewMeal) queries.InsertMealLogParams {
	p := queries.InsertMealLogParams{
		UserID: userID, OnDate: date, MealType: m.MealType, FoodID: m.FoodID, FreeText: m.Name,
		Kcal: m.Kcal, ProteinG: m.ProteinG, CarbsG: m.CarbsG, FatG: m.FatG, SugarG: m.SugarG, FiberG: m.FiberG,
		SodiumMg: m.SodiumMg, EntryMethod: m.EntryMethod, PhotoEstimate: m.PhotoEstimate,
	}
	if m.QuantityG != nil {
		p.QuantityG = pgtype.Float8{Float64: *m.QuantityG, Valid: true}
	}
	return p
}

// DeleteMeal removes the user's log and refunds what it earned with a
// meal_log_undo:<id> ledger row.
func (s *NutritionStore) DeleteMeal(ctx context.Context, userID, id uuid.UUID) (int, error) {
	var refunded int
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		if err := q.LockProfile(ctx, userID); err != nil {
			return fmt.Errorf("lock profile: %w", err)
		}
		n, err := q.DeleteMealLog(ctx, queries.DeleteMealLogParams{ID: id, UserID: userID})
		if err != nil {
			return err
		}
		if n == 0 {
			return appnutrition.ErrNotFound
		}
		outstanding, err := q.MealXPOutstanding(ctx, queries.MealXPOutstandingParams{UserID: userID, MealLogID: id.String()})
		if err != nil || outstanding <= 0 {
			return err
		}
		reason := "meal_log_undo:" + id.String()
		if err := q.InsertXPTransaction(ctx, queries.InsertXPTransactionParams{UserID: userID, Amount: -outstanding, Reason: reason}); err != nil {
			return fmt.Errorf("insert xp refund: %w", err)
		}
		if _, err := q.AddProfileXP(ctx, queries.AddProfileXPParams{UserID: userID, Amount: -outstanding}); err != nil {
			return err
		}
		refunded = int(outstanding)
		return nil
	})
	return refunded, err
}

// Country is the profile's country as typed.
func (s *NutritionStore) Country(ctx context.Context, userID uuid.UUID) (*string, error) {
	var country *string
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		country, err = q.ProfileCountry(ctx, userID)
		return err
	})
	return country, err
}

var _ appnutrition.PlanStore = (*NutritionStore)(nil)

// PlanProfile reads the body data targets are sized from.
func (s *NutritionStore) PlanProfile(ctx context.Context, userID uuid.UUID) (appnutrition.PlanProfile, error) {
	var p appnutrition.PlanProfile
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		row, err := q.MealPlanProfile(ctx, userID)
		if err != nil {
			return err
		}
		p = appnutrition.PlanProfile{
			Sex: row.Sex, BirthDate: ymd(row.BirthDate), HeightCm: numeric(row.HeightCm), WeightKg: numeric(row.WeightKg), Country: row.Country,
		}
		return nil
	})
	return p, err
}

// TrainingDaysPerWeek counts distinct weekdays with a fixed session.
func (s *NutritionStore) TrainingDaysPerWeek(ctx context.Context, userID uuid.UUID) (int, error) {
	var days int32
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		days, err = q.CountTrainingDays(ctx, userID)
		return err
	})
	return int(days), err
}

// BodyAnalysis is the newest analyzed body photo's analysis.
func (s *NutritionStore) BodyAnalysis(ctx context.Context, userID uuid.UUID) (json.RawMessage, error) {
	var analysis []byte
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		a, err := q.LatestBodyAnalysis(ctx, userID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		analysis = a
		return err
	})
	return analysis, err
}

// HasActiveTrainingPlan reports any active training plan.
func (s *NutritionStore) HasActiveTrainingPlan(ctx context.Context, userID uuid.UUID) (bool, error) {
	var has bool
	err := s.asUser(ctx, userID, func(q *queries.Queries) (err error) {
		has, err = q.HasActiveTrainingPlan(ctx, userID)
		return err
	})
	return has, err
}

// ActiveMealPlan loads the active plan and its meals (day, then plan order).
func (s *NutritionStore) ActiveMealPlan(ctx context.Context, userID uuid.UUID) (*appnutrition.MealPlan, error) {
	var plan *appnutrition.MealPlan
	err := s.asUser(ctx, userID, func(q *queries.Queries) error {
		menu, err := loadActiveMenu(ctx, q, userID)
		if err != nil || menu == nil {
			return err
		}
		row := menu.plan
		plan = &appnutrition.MealPlan{
			ID:      row.ID,
			Targets: nutrition.Targets{Kcal: row.KcalTarget, ProteinG: row.ProteinGTarget, CarbsG: row.CarbsGTarget, FatG: row.FatGTarget},
			Items:   make([]appnutrition.MealPlanItem, len(menu.items)),
		}
		_ = json.Unmarshal(row.Intake, &plan.Intake)
		for i, r := range menu.items {
			meal := aigen.PlannedMeal{
				DayOfWeek: int(r.DayOfWeek), MealType: r.MealType, Title: r.Title, Recipe: deref(r.Recipe), VideoQuery: deref(r.VideoQuery),
				Kcal: r.Kcal, ProteinG: r.ProteinG, CarbsG: r.CarbsG, FatG: r.FatG, SugarG: r.SugarG, FiberG: r.FiberG, SodiumMg: r.SodiumMg,
				Ingredients: []nutrition.Ingredient{},
			}
			_ = json.Unmarshal(r.Ingredients, &meal.Ingredients)
			plan.Items[i] = appnutrition.MealPlanItem{ID: r.ID, PlannedMeal: meal}
		}
		return nil
	})
	return plan, err
}

// SaveMealPlan replaces the active plan and syncs the calorie goal.
func (s *NutritionStore) SaveMealPlan(ctx context.Context, userID uuid.UUID, plan appnutrition.NewMealPlan) error {
	intake, err := json.Marshal(plan.Intake)
	if err != nil {
		return err
	}
	t := plan.Targets
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		if _, err := q.ArchiveMealPlans(ctx, userID); err != nil {
			return fmt.Errorf("archive plan: %w", err)
		}
		planID, err := q.InsertMealPlan(ctx, queries.InsertMealPlanParams{
			UserID: userID, Intake: intake, Kcal: t.Kcal, ProteinG: t.ProteinG, CarbsG: t.CarbsG, FatG: t.FatG,
		})
		if err != nil {
			return fmt.Errorf("insert plan: %w", err)
		}
		for i, m := range plan.Meals {
			ingredients, err := json.Marshal(m.Ingredients)
			if err != nil {
				return err
			}
			if err := q.InsertMealPlanItem(ctx, queries.InsertMealPlanItemParams{
				PlanID: planID, UserID: userID, DayOfWeek: int32(m.DayOfWeek), MealType: m.MealType, Title: m.Title, // #nosec G115 -- 0..6
				Ingredients: ingredients, Recipe: m.Recipe, VideoQuery: m.VideoQuery, Kcal: m.Kcal, ProteinG: m.ProteinG,
				CarbsG: m.CarbsG, FatG: m.FatG, SugarG: m.SugarG, FiberG: m.FiberG, SodiumMg: m.SodiumMg, Sort: int32(i), // #nosec G115 -- ≤ 40 meals
			}); err != nil {
				return fmt.Errorf("insert meal %d: %w", i, err)
			}
		}
		updated, err := q.UpdateCalorieGoal(ctx, queries.UpdateCalorieGoalParams{Kcal: t.Kcal, UserID: userID})
		if err != nil || updated > 0 {
			return err
		}
		return q.InsertCalorieGoal(ctx, queries.InsertCalorieGoalParams{UserID: userID, Kcal: t.Kcal})
	})
}

// ArchiveMealPlan retires the active plan (a no-op without one).
func (s *NutritionStore) ArchiveMealPlan(ctx context.Context, userID uuid.UUID) error {
	return s.asUser(ctx, userID, func(q *queries.Queries) error {
		_, err := q.ArchiveMealPlans(ctx, userID)
		return err
	})
}
