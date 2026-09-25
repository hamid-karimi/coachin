// Package nutrition is meal logging: the day's meals against the calorie
// goal, food search (local, then USDA on request), logging with meal XP, and
// the weekly/monthly trends.
package nutrition

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

// Meal is a logged meal.
type Meal struct {
	ID          uuid.UUID
	MealType    string
	Name        *string
	QuantityG   *float64
	EntryMethod string // search | photo | manual
	nutrition.Nutrients
}

// Food is a searchable food with its nutrients per 100 g.
type Food struct {
	ID     uuid.UUID
	Name   string
	Source string // seed | usda | custom
	nutrition.Per100g
}

// NewMeal is a meal to store.
type NewMeal struct {
	MealType      string
	FoodID        *uuid.UUID
	Name          string
	QuantityG     *float64
	EntryMethod   string
	PhotoEstimate json.RawMessage
	nutrition.Nutrients
}

// Awards is the XP a batch of logs earned.
type Awards struct {
	MealXP    int
	Capped    bool // some log hit the 3-a-day meal cap
	Adherence int  // yesterday's calorie-goal bonus
}

// MealRules decide meal XP inside the store's transaction: a new meal's award
// from its date's awarded count, and a finished day's calorie-goal bonus.
type MealRules struct {
	Award      func(awardedOnDate int) (xp int, capped bool)
	CalorieDay func(target *float64, totalKcal float64, meals int) int
}

// DefaultMealRules are FORMULAS §2's meal rules.
var DefaultMealRules = MealRules{Award: nutrition.MealAward, CalorieDay: nutrition.CalorieDayXP}

// ErrNotFound means the food or meal doesn't exist (for this user).
var ErrNotFound = errors.New("not found")

// Store is the persistence meal logging needs; every call runs as the user.
type Store interface {
	Meals(ctx context.Context, userID uuid.UUID, date string) ([]Meal, error)
	// CalorieTarget is the active calorie_intake goal, nil without one.
	CalorieTarget(ctx context.Context, userID uuid.UUID) (*float64, error)
	NutrientsSince(ctx context.Context, userID uuid.UUID, from string) ([]nutrition.DatedNutrients, error)
	SearchFoods(ctx context.Context, userID uuid.UUID, query string) ([]Food, error)
	// Food returns ErrNotFound for an unknown id.
	Food(ctx context.Context, userID uuid.UUID, id uuid.UUID) (Food, error)
	// SaveUSDAFood stores a USDA food once (by its FDC id) and returns the row.
	SaveUSDAFood(ctx context.Context, userID uuid.UUID, food nutrition.USDAFood) (Food, error)
	// LogMeals stores the meals dated date, awards their meal XP, and settles
	// the calorie-goal bonus for adherenceDate, in one transaction.
	LogMeals(ctx context.Context, userID uuid.UUID, date, adherenceDate string, meals []NewMeal, rules MealRules) (Awards, error)
	// DeleteMeal removes the log and gives back its meal XP; ErrNotFound when
	// it isn't the user's.
	DeleteMeal(ctx context.Context, userID, id uuid.UUID) (refundedXP int, err error)
	// Country is the profile's free-text country, nil when unset.
	Country(ctx context.Context, userID uuid.UUID) (*string, error)
}

// USDA is FoodData Central.
type USDA interface {
	Enabled() bool
	Search(ctx context.Context, query string) ([]nutrition.USDAFood, error)
	Food(ctx context.Context, fdcID int64) (nutrition.USDAFood, error)
}

// Service runs the use cases. now is injectable for tests.
type Service struct {
	store Store
	usda  USDA
	ai    AI
	now   func() time.Time
}

// NewService builds the service; now defaults to time.Now.
func NewService(store Store, usda USDA, ai AI, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{store: store, usda: usda, ai: ai, now: now}
}

// Day is the nutrition page: today's meals and totals, the goal, and trends.
type Day struct {
	Date        string
	Target      *float64
	Meals       []Meal
	Totals      nutrition.Nutrients
	Week, Month nutrition.Period
	USDAEnabled bool
}

// Day loads today's log and the 7- and 30-day trends.
func (s *Service) Day(ctx context.Context, userID uuid.UUID) (Day, error) {
	now := s.now()
	today := dates.ToYMD(now)
	meals, err := s.store.Meals(ctx, userID, today)
	if err != nil {
		return Day{}, fmt.Errorf("load meals: %w", err)
	}
	target, err := s.store.CalorieTarget(ctx, userID)
	if err != nil {
		return Day{}, fmt.Errorf("load calorie goal: %w", err)
	}
	rows, err := s.store.NutrientsSince(ctx, userID, dates.ToYMD(now.AddDate(0, 0, -29)))
	if err != nil {
		return Day{}, fmt.Errorf("load trends: %w", err)
	}
	day := Day{Date: today, Target: target, Meals: meals, USDAEnabled: s.usda.Enabled()}
	totals := make([]nutrition.Nutrients, len(meals))
	for i, m := range meals {
		totals[i] = m.Nutrients
	}
	day.Totals = nutrition.Sum(totals)
	if day.Week, err = nutrition.SummarizePeriod(rows, 7, today); err != nil {
		return Day{}, err
	}
	if day.Month, err = nutrition.SummarizePeriod(rows, 30, today); err != nil {
		return Day{}, err
	}
	return day, nil
}

// searchQuery trims and caps a search; under 2 characters there is none.
func searchQuery(q string) (string, bool) {
	q = jsnum.Slice(strings.TrimSpace(q), 80)
	return q, len([]rune(q)) >= 2
}

// SearchFoods matches the local foods table (up to 8).
func (s *Service) SearchFoods(ctx context.Context, userID uuid.UUID, q string) ([]Food, error) {
	query, ok := searchQuery(q)
	if !ok {
		return []Food{}, nil
	}
	return s.store.SearchFoods(ctx, userID, query)
}

// SearchUSDA asks FoodData Central (up to 6 matches with calories).
func (s *Service) SearchUSDA(ctx context.Context, q string) ([]nutrition.USDAFood, error) {
	if !s.usda.Enabled() {
		return nil, apperr.New(apperr.Unavailable, "USDA search is not configured")
	}
	query, ok := searchQuery(q)
	if !ok {
		return []nutrition.USDAFood{}, nil
	}
	foods, err := s.usda.Search(ctx, query)
	if err != nil {
		return nil, apperr.New(apperr.Unavailable, "USDA search failed — try again later")
	}
	return foods, nil
}

// MealInput is one logged meal: a local food or a USDA food with an amount
// in grams, or a manual entry.
type MealInput struct {
	MealType  string
	FoodID    *uuid.UUID
	USDAFdcID *int64
	QuantityG float64
	Manual    *ManualMeal
}

// ManualMeal is a hand-entered meal.
type ManualMeal struct {
	Name     string
	Kcal     float64
	ProteinG float64
	CarbsG   float64
	FatG     float64
}

// LogMeal validates and stores one meal (+5 XP, at most 3 a day) and settles
// yesterday's calorie-goal bonus.
func (s *Service) LogMeal(ctx context.Context, userID uuid.UUID, in MealInput) (string, error) {
	if !nutrition.MealTypes[in.MealType] {
		return "", apperr.New(apperr.Invalid, "Pick a meal type")
	}
	meal, err := s.newMeal(ctx, userID, in)
	if err != nil {
		return "", err
	}
	awards, err := s.log(ctx, userID, []NewMeal{meal})
	if err != nil {
		return "", err
	}
	return AwardMessage("Meal logged", awards), nil
}

func (s *Service) newMeal(ctx context.Context, userID uuid.UUID, in MealInput) (NewMeal, error) {
	if in.FoodID == nil && in.USDAFdcID == nil {
		return manualMeal(in.MealType, in.Manual)
	}
	if !jsnum.IsFinite(in.QuantityG) || in.QuantityG <= 0 || in.QuantityG > nutrition.MaxPortionGrams {
		return NewMeal{}, apperr.New(apperr.Invalid, "Enter the amount in grams")
	}
	food, err := s.food(ctx, userID, in)
	if err != nil {
		return NewMeal{}, err
	}
	grams := in.QuantityG
	return NewMeal{
		MealType: in.MealType, FoodID: &food.ID, Name: food.Name, QuantityG: &grams, EntryMethod: "search",
		Nutrients: nutrition.Portion(food.Per100g, grams),
	}, nil
}

// food resolves the picked food; a USDA pick is re-read from USDA (never
// trusted from the client) and kept in the local foods table.
func (s *Service) food(ctx context.Context, userID uuid.UUID, in MealInput) (Food, error) {
	if in.FoodID != nil {
		food, err := s.store.Food(ctx, userID, *in.FoodID)
		if errors.Is(err, ErrNotFound) {
			return Food{}, apperr.New(apperr.NotFound, "Food not found")
		}
		return food, err
	}
	if !s.usda.Enabled() {
		return Food{}, apperr.New(apperr.Unavailable, "USDA search is not configured")
	}
	remote, err := s.usda.Food(ctx, *in.USDAFdcID)
	if err != nil {
		return Food{}, apperr.New(apperr.Unavailable, "Failed to save the USDA food")
	}
	if remote.Name == "" || remote.Kcal < 0 {
		return Food{}, apperr.New(apperr.Invalid, "Invalid USDA item")
	}
	return s.store.SaveUSDAFood(ctx, userID, remote)
}

func manualMeal(mealType string, m *ManualMeal) (NewMeal, error) {
	if m == nil || strings.TrimSpace(m.Name) == "" {
		return NewMeal{}, apperr.New(apperr.Invalid, "Name the food or pick one from search")
	}
	if !jsnum.IsFinite(m.Kcal) || m.Kcal <= 0 || m.Kcal > nutrition.MaxMealKcal {
		return NewMeal{}, apperr.New(apperr.Invalid, "Enter the calories (1-5000)")
	}
	return NewMeal{
		MealType: mealType, Name: jsnum.Slice(strings.TrimSpace(m.Name), 200), EntryMethod: "manual",
		Nutrients: nutrition.Nutrients{
			Kcal: jsnum.Round(m.Kcal), ProteinG: nutrition.NonNegative(m.ProteinG),
			CarbsG: nutrition.NonNegative(m.CarbsG), FatG: nutrition.NonNegative(m.FatG),
		},
	}, nil
}

// log stores meals dated today and settles yesterday's calorie-goal bonus.
func (s *Service) log(ctx context.Context, userID uuid.UUID, meals []NewMeal) (Awards, error) {
	now := s.now()
	awards, err := s.store.LogMeals(ctx, userID, dates.ToYMD(now), dates.ToYMD(now.AddDate(0, 0, -1)), meals, DefaultMealRules)
	if err != nil {
		return Awards{}, fmt.Errorf("log meals: %w", err)
	}
	return awards, nil
}

// AwardMessage is the legacy toast: "Meal logged · +5 XP.", "… · daily meal XP
// cap reached.", plus the calorie-goal bonus.
func AwardMessage(base string, a Awards) string {
	parts := []string{base}
	switch {
	case a.MealXP > 0:
		parts = append(parts, fmt.Sprintf("+%d XP", a.MealXP))
	case a.Capped:
		parts = append(parts, "daily meal XP cap reached")
	}
	if a.Adherence > 0 {
		parts = append(parts, fmt.Sprintf("+%d XP for hitting yesterday's calorie goal", a.Adherence))
	}
	return strings.Join(parts, " · ") + "."
}

// DeleteMeal removes a meal and gives back the XP it earned (so the daily cap
// can't be farmed by deleting and re-logging).
func (s *Service) DeleteMeal(ctx context.Context, userID, id uuid.UUID) (string, error) {
	refunded, err := s.store.DeleteMeal(ctx, userID, id)
	if errors.Is(err, ErrNotFound) {
		return "Meal removed.", nil // already gone: nothing to undo
	}
	if err != nil {
		return "", fmt.Errorf("delete meal: %w", err)
	}
	if refunded > 0 {
		return fmt.Sprintf("Meal removed · -%d XP.", refunded), nil
	}
	return "Meal removed.", nil
}
