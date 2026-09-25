package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

type fakeMealPlan struct{ intake appnutrition.PlanIntake }

func (f *fakeMealPlan) Page(context.Context, uuid.UUID) (appnutrition.PlanPage, error) {
	return appnutrition.PlanPage{
		Plan: &appnutrition.MealPlan{
			Targets: nutrition.Targets{Kcal: 1900},
			Intake:  appnutrition.PlanIntake{Goal: "lose", Diet: "vegan", MealsPerDay: 3},
			Items: []appnutrition.MealPlanItem{{ID: uuid.New(), PlannedMeal: aigen.PlannedMeal{
				DayOfWeek: 1, MealType: "breakfast", Title: "Oats", Kcal: 450,
				Ingredients: []nutrition.Ingredient{{Name: "Oats", Qty: "80 g"}},
			}}},
		},
		Grocery: []nutrition.GroceryLine{{Name: "Oats", Count: 1}},
	}, nil
}
func (f *fakeMealPlan) Generate(_ context.Context, _ uuid.UUID, in appnutrition.PlanIntake) (string, error) {
	f.intake = in
	return "Meal plan ready — your calorie goal is set to match.", nil
}
func (f *fakeMealPlan) Regenerate(context.Context, uuid.UUID) (string, error) {
	return "", apperr.New(apperr.NotFound, "No meal plan to regenerate")
}
func (f *fakeMealPlan) Discard(context.Context, uuid.UUID) (string, error) {
	return "Meal plan discarded.", nil
}

func TestMealPlanRoutes(t *testing.T) {
	fake := &fakeMealPlan{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, MealPlan: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}

	rec := send(t, h, http.MethodGet, BasePath+"/nutrition/plan", "", cookie)
	var page MealPlanPageBody
	_ = json.Unmarshal(rec.Body.Bytes(), &page)
	if rec.Code != http.StatusOK || page.Plan == nil || page.Plan.Intake.Allergies == nil || page.Plan.Meals[0].Ingredients[0].Qty != "80 g" ||
		page.Plan.Meals[0].Nutrients.Kcal != 450 || len(page.Grocery) != 1 {
		t.Fatalf("page: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/nutrition/plan",
		`{"goal":"gain","diet":"halal","allergies":["peanuts"],"dislikes":[],"mealsPerDay":4}`, cookie)
	if rec.Code != http.StatusCreated || fake.intake.Diet != "halal" || fake.intake.MealsPerDay != 4 || fake.intake.Allergies[0] != "peanuts" {
		t.Fatalf("generate: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/nutrition/plan/regenerate", "", cookie); rec.Code != http.StatusNotFound {
		t.Fatalf("regenerate: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/nutrition/plan", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("discard: %d", rec.Code)
	}
}
