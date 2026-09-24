package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

type fakeNutrition struct{ logged appnutrition.MealInput }

func (f *fakeNutrition) Day(context.Context, uuid.UUID) (appnutrition.Day, error) {
	return appnutrition.Day{
		Date: "2026-09-24", Meals: []appnutrition.Meal{{ID: uuid.New(), MealType: "lunch", EntryMethod: "manual",
			Nutrients: nutrition.Nutrients{Kcal: 500, ProteinG: 30}}},
		Totals: nutrition.Nutrients{Kcal: 500}, Week: nutrition.Period{Series: []nutrition.DailyPoint{}}, Month: nutrition.Period{Series: []nutrition.DailyPoint{}},
	}, nil
}
func (f *fakeNutrition) SearchFoods(context.Context, uuid.UUID, string) ([]appnutrition.Food, error) {
	return []appnutrition.Food{{ID: uuid.New(), Name: "Oats", Source: "seed", Per100g: nutrition.Per100g{Kcal: 389}}}, nil
}
func (f *fakeNutrition) SearchUSDA(context.Context, string) ([]nutrition.USDAFood, error) {
	return nil, apperr.New(apperr.Unavailable, "USDA search is not configured")
}
func (f *fakeNutrition) LogMeal(_ context.Context, _ uuid.UUID, in appnutrition.MealInput) (string, error) {
	f.logged = in
	return "Meal logged · +5 XP.", nil
}
func (f *fakeNutrition) DeleteMeal(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "Meal removed · -5 XP.", nil
}

func TestNutritionRoutes(t *testing.T) {
	fake := &fakeNutrition{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Nutrition: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}

	rec := send(t, h, http.MethodGet, BasePath+"/nutrition/day", "", cookie)
	var day NutritionDayBody
	_ = json.Unmarshal(rec.Body.Bytes(), &day)
	if rec.Code != http.StatusOK || len(day.Meals) != 1 || day.Meals[0].Nutrients.ProteinG != 30 || day.Target != nil {
		t.Fatalf("day: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodGet, BasePath+"/foods?q=oat", "", cookie)
	var foods []FoodBody
	_ = json.Unmarshal(rec.Body.Bytes(), &foods)
	if rec.Code != http.StatusOK || len(foods) != 1 || foods[0].Per100g.Kcal != 389 {
		t.Fatalf("foods: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/foods/usda?q=banana", "", cookie); rec.Code != http.StatusBadGateway {
		t.Fatalf("usda disabled: %d", rec.Code)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/meals", `{"mealType":"dinner","manual":{"name":"Soup","kcal":300,"proteinG":12}}`, cookie)
	if rec.Code != http.StatusCreated || fake.logged.Manual == nil || fake.logged.Manual.ProteinG != 12 || fake.logged.MealType != "dinner" {
		t.Fatalf("log: %d %s %+v", rec.Code, rec.Body, fake.logged)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/meals", `{"mealType":"brunch"}`, cookie); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("bad meal type: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/meals/"+uuid.NewString(), "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("delete: %d", rec.Code)
	}
}
