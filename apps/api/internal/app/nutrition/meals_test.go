package nutrition

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

type fakeStore struct {
	foods     map[uuid.UUID]Food
	saved     []nutrition.USDAFood
	logged    []NewMeal
	dates     [2]string
	awards    Awards
	target    *float64
	meals     []Meal
	rows      []nutrition.DatedNutrients
	refund    int
	deleteErr error
	country   *string
}

func (f *fakeStore) Meals(context.Context, uuid.UUID, string) ([]Meal, error) { return f.meals, nil }
func (f *fakeStore) CalorieTarget(context.Context, uuid.UUID) (*float64, error) {
	return f.target, nil
}
func (f *fakeStore) NutrientsSince(context.Context, uuid.UUID, string) ([]nutrition.DatedNutrients, error) {
	return f.rows, nil
}
func (f *fakeStore) SearchFoods(context.Context, uuid.UUID, string) ([]Food, error) {
	return []Food{{Name: "Oats"}}, nil
}
func (f *fakeStore) Food(_ context.Context, _ uuid.UUID, id uuid.UUID) (Food, error) {
	food, ok := f.foods[id]
	if !ok {
		return Food{}, ErrNotFound
	}
	return food, nil
}
func (f *fakeStore) SaveUSDAFood(_ context.Context, _ uuid.UUID, food nutrition.USDAFood) (Food, error) {
	f.saved = append(f.saved, food)
	return Food{ID: uuid.New(), Name: food.Name, Source: "usda", Per100g: food.Per100g}, nil
}
func (f *fakeStore) LogMeals(_ context.Context, _ uuid.UUID, date, adherenceDate string, meals []NewMeal) (Awards, error) {
	f.logged = append(f.logged, meals...)
	f.dates = [2]string{date, adherenceDate}
	return f.awards, nil
}
func (f *fakeStore) Country(context.Context, uuid.UUID) (*string, error) { return f.country, nil }
func (f *fakeStore) DeleteMeal(context.Context, uuid.UUID, uuid.UUID) (int, error) {
	return f.refund, f.deleteErr
}

type fakeUSDA struct {
	enabled bool
	food    nutrition.USDAFood
	err     error
}

func (u fakeUSDA) Enabled() bool { return u.enabled }
func (u fakeUSDA) Search(context.Context, string) ([]nutrition.USDAFood, error) {
	return []nutrition.USDAFood{u.food}, u.err
}
func (u fakeUSDA) Food(context.Context, int64) (nutrition.USDAFood, error) { return u.food, u.err }

var now = func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) }

func message(err error) string {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Message
	}
	return "unexpected: " + err.Error()
}

func TestLogMealValidation(t *testing.T) {
	food := uuid.New()
	svc := NewService(&fakeStore{foods: map[uuid.UUID]Food{}}, fakeUSDA{}, nil, now)
	fdc := int64(1)
	cases := map[string]MealInput{
		"Pick a meal type":                      {MealType: "brunch"},
		"Name the food or pick one from search": {MealType: "lunch", Manual: &ManualMeal{Name: "  ", Kcal: 100}},
		"Enter the calories (1-5000)":           {MealType: "lunch", Manual: &ManualMeal{Name: "Soup", Kcal: 5001}},
		"Enter the amount in grams":             {MealType: "lunch", FoodID: &food, QuantityG: 0},
		"Food not found":                        {MealType: "lunch", FoodID: &food, QuantityG: 100},
		"USDA search is not configured":         {MealType: "lunch", USDAFdcID: &fdc, QuantityG: 100},
	}
	for want, in := range cases {
		if _, err := svc.LogMeal(context.Background(), uuid.New(), in); message(err) != want {
			t.Errorf("%s: %v", want, err)
		}
	}
	if _, err := svc.LogMeal(context.Background(), uuid.New(), MealInput{MealType: "lunch"}); message(err) != "Name the food or pick one from search" {
		t.Errorf("nothing picked: %v", err)
	}
}

func TestLogMealFromSearchAndManual(t *testing.T) {
	oats := uuid.New()
	store := &fakeStore{
		foods:  map[uuid.UUID]Food{oats: {ID: oats, Name: "Oats", Per100g: nutrition.Per100g{Kcal: 389, ProteinG: 16.9, SodiumMg: 2}}},
		awards: Awards{MealXP: 5, Adherence: 30},
	}
	svc := NewService(store, fakeUSDA{}, nil, now)
	msg, err := svc.LogMeal(context.Background(), uuid.New(), MealInput{MealType: "breakfast", FoodID: &oats, QuantityG: 60})
	if err != nil || msg != "Meal logged · +5 XP · +30 XP for hitting yesterday's calorie goal." {
		t.Fatalf("msg = %q, %v", msg, err)
	}
	m := store.logged[0]
	if m.Name != "Oats" || *m.QuantityG != 60 || m.Kcal != 233 || m.ProteinG != 10.1 || m.SodiumMg != 1 || m.EntryMethod != "search" {
		t.Errorf("meal = %+v", m)
	}
	if store.dates != [2]string{"2026-09-24", "2026-09-23"} {
		t.Errorf("dates = %v", store.dates)
	}

	store.awards = Awards{Capped: true}
	msg, _ = svc.LogMeal(context.Background(), uuid.New(), MealInput{MealType: "snack", Manual: &ManualMeal{Name: " Soup ", Kcal: 249.6, ProteinG: -3, FatG: 4.25}})
	if msg != "Meal logged · daily meal XP cap reached." {
		t.Errorf("capped msg = %q", msg)
	}
	soup := store.logged[1]
	if soup.Name != "Soup" || soup.Kcal != 250 || soup.ProteinG != 0 || soup.FatG != 4.25 || soup.EntryMethod != "manual" || soup.QuantityG != nil {
		t.Errorf("soup = %+v", soup)
	}
}

func TestLogUSDAMealRereadsUSDA(t *testing.T) {
	store := &fakeStore{}
	banana := nutrition.USDAFood{FdcID: 173944, Name: "Bananas, raw", Per100g: nutrition.Per100g{Kcal: 89, CarbsG: 22.8}}
	svc := NewService(store, fakeUSDA{enabled: true, food: banana}, nil, now)
	fdc := int64(173944)
	if _, err := svc.LogMeal(context.Background(), uuid.New(), MealInput{MealType: "snack", USDAFdcID: &fdc, QuantityG: 120}); err != nil {
		t.Fatal(err)
	}
	if len(store.saved) != 1 || store.logged[0].Kcal != 107 || store.logged[0].CarbsG != 27.4 || store.logged[0].FoodID == nil {
		t.Errorf("saved %+v, logged %+v", store.saved, store.logged)
	}
	svc = NewService(&fakeStore{}, fakeUSDA{enabled: true, err: errors.New("down")}, nil, now)
	if _, err := svc.LogMeal(context.Background(), uuid.New(), MealInput{MealType: "snack", USDAFdcID: &fdc, QuantityG: 120}); message(err) != "Failed to save the USDA food" {
		t.Errorf("usda down: %v", err)
	}
}

func TestSearchAndDay(t *testing.T) {
	target := 2000.0
	store := &fakeStore{
		target: &target,
		meals:  []Meal{{Nutrients: nutrition.Nutrients{Kcal: 500, ProteinG: 30}}, {Nutrients: nutrition.Nutrients{Kcal: 250, ProteinG: 10}}},
		rows:   []nutrition.DatedNutrients{{Date: "2026-09-24", Nutrients: nutrition.Nutrients{Kcal: 750}}, {Date: "2026-08-20", Nutrients: nutrition.Nutrients{Kcal: 100}}},
	}
	svc := NewService(store, fakeUSDA{}, nil, now)
	if foods, _ := svc.SearchFoods(context.Background(), uuid.New(), " o "); len(foods) != 0 {
		t.Error("a 1-character query must not search")
	}
	if _, err := svc.SearchUSDA(context.Background(), "banana"); message(err) != "USDA search is not configured" {
		t.Errorf("usda disabled: %v", err)
	}
	day, err := svc.Day(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if day.Date != "2026-09-24" || day.Totals.Kcal != 750 || day.Totals.ProteinG != 40 || *day.Target != 2000 || day.USDAEnabled {
		t.Errorf("day = %+v", day)
	}
	if day.Week.DaysLogged != 1 || day.Month.DaysLogged != 1 || len(day.Month.Series) != 30 {
		t.Errorf("trends week=%d month=%d (Aug 20 is outside 30 days)", day.Week.DaysLogged, day.Month.DaysLogged)
	}
}

func TestDeleteMeal(t *testing.T) {
	cases := []struct {
		store fakeStore
		want  string
	}{
		{fakeStore{refund: 5}, "Meal removed · -5 XP."},
		{fakeStore{}, "Meal removed."},
		{fakeStore{deleteErr: ErrNotFound}, "Meal removed."},
	}
	for _, c := range cases {
		store := c.store
		if msg, err := NewService(&store, fakeUSDA{}, nil, now).DeleteMeal(context.Background(), uuid.New(), uuid.New()); err != nil || msg != c.want {
			t.Errorf("got %q, %v; want %q", msg, err, c.want)
		}
	}
}
