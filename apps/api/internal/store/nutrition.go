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

// mealAward is award_meal_xp's answer.
type mealAward struct {
	rpcResult
	Capped bool `json:"capped"`
}

// LogMeals stores the meals and their XP, and settles the calorie-goal bonus,
// in one transaction; the profile lock serializes the 3-a-day cap.
func (s *NutritionStore) LogMeals(ctx context.Context, userID uuid.UUID, date, adherenceDate string, meals []appnutrition.NewMeal) (appnutrition.Awards, error) {
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
			raw, err := q.AwardMealXP(ctx, id)
			var award mealAward
			if err := decodeRPC(raw, err, &award); err != nil {
				return err
			}
			awards.MealXP += award.AwardedXP
			awards.Capped = awards.Capped || award.Capped
		}
		raw, err := q.AwardDayAdherence(ctx, adherenceDate)
		var bonus rpcResult
		if err := decodeRPC(raw, err, &bonus); err != nil {
			return err
		}
		awards.Adherence = bonus.AwardedXP
		return nil
	})
	return awards, err
}

// decodeRPC decodes a Step A function's jsonb answer (and the call's error),
// failing on {"error": …}.
func decodeRPC(raw string, callErr error, out interface{ failure() string }) error {
	if callErr != nil {
		return callErr
	}
	if err := json.Unmarshal([]byte(raw), out); err != nil {
		return err
	}
	if msg := out.failure(); msg != "" {
		return errors.New(msg)
	}
	return nil
}

func (r *rpcResult) failure() string {
	if r.Success {
		return ""
	}
	return r.Error
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
