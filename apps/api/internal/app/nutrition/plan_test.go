package nutrition

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

type fakePlanStore struct {
	profile  PlanProfile
	days     int
	analysis json.RawMessage
	training bool
	active   *MealPlan
	saved    []NewMealPlan
	archived int
}

func (f *fakePlanStore) PlanProfile(context.Context, uuid.UUID) (PlanProfile, error) {
	return f.profile, nil
}
func (f *fakePlanStore) TrainingDaysPerWeek(context.Context, uuid.UUID) (int, error) {
	return f.days, nil
}
func (f *fakePlanStore) BodyAnalysis(context.Context, uuid.UUID) (json.RawMessage, error) {
	return f.analysis, nil
}
func (f *fakePlanStore) HasActiveTrainingPlan(context.Context, uuid.UUID) (bool, error) {
	return f.training, nil
}
func (f *fakePlanStore) ActiveMealPlan(context.Context, uuid.UUID) (*MealPlan, error) {
	return f.active, nil
}
func (f *fakePlanStore) SaveMealPlan(_ context.Context, _ uuid.UUID, plan NewMealPlan) error {
	f.saved = append(f.saved, plan)
	return nil
}
func (f *fakePlanStore) ArchiveMealPlan(context.Context, uuid.UUID) error {
	f.archived++
	return nil
}

func fullProfile() PlanProfile {
	sex, birth, height, weight, country := "female", "1994-03-10", 168.0, 62.0, "Iran"
	return PlanProfile{Sex: &sex, BirthDate: &birth, HeightCm: &height, WeightKg: &weight, Country: &country}
}

const menu = `{"items":[{"day_of_week":1,"meal_type":"breakfast","title":"Oats","ingredients":[{"name":"Oats","qty":"80 g"}],"kcal":450}]}`

func TestGenerateMealPlan(t *testing.T) {
	store := &fakePlanStore{profile: fullProfile(), analysis: json.RawMessage(`{"build_notes":"Lean build.","posture_notes":""}`)}
	ai := &replyAI{text: menu}
	msg, err := NewPlans(store, ai, now).Generate(context.Background(), uuid.New(), PlanIntake{
		Goal: "lose", Diet: "  ", Allergies: []string{" peanuts ", "", strings.Repeat("x", 80)}, MealsPerDay: 5,
	})
	if err != nil || msg != "Meal plan ready — your calorie goal is set to match." {
		t.Fatalf("msg = %q, %v", msg, err)
	}
	plan := store.saved[0]
	if plan.Intake.Diet != "omnivore" || plan.Intake.MealsPerDay != 3 || len(plan.Intake.Allergies) != 2 ||
		plan.Intake.Allergies[0] != "peanuts" || len([]rune(plan.Intake.Allergies[1])) != 60 {
		t.Errorf("intake = %+v", plan.Intake)
	}
	if plan.Targets.Kcal <= 0 || len(plan.Meals) != 1 || plan.Meals[0].Title != "Oats" {
		t.Errorf("plan = %+v", plan)
	}
	prompt := ai.requests[0].Prompt
	for _, want := range []string{"with 3 meals per day", "Goal: lose. Diet: omnivore.", "STRICTLY avoid these allergens: peanuts,",
		"Athlete context (consented): Lean build.", "The user lives in Iran:"} {
		if !strings.Contains(prompt, want) {
			t.Errorf("prompt lacks %q:\n%s", want, prompt)
		}
	}
}

func TestGenerateMealPlanErrors(t *testing.T) {
	cases := map[string]struct {
		store fakePlanStore
		goal  string
		reply string
	}{
		"Pick a goal": {fakePlanStore{profile: fullProfile()}, "bulk", menu},
		"Add your height, weight, and birth date on your profile so we can size your targets.": {fakePlanStore{}, "gain", menu},
		"AI is temporarily unavailable — try again later":                                      {fakePlanStore{profile: fullProfile()}, "gain", ""},
		"Couldn't generate a plan — try again.":                                                {fakePlanStore{profile: fullProfile()}, "gain", `{"items":[]}`},
	}
	for want, c := range cases {
		store := c.store
		if _, err := NewPlans(&store, &replyAI{text: c.reply}, now).Generate(context.Background(), uuid.New(), PlanIntake{Goal: c.goal}); message(err) != want {
			t.Errorf("%s: %v", want, err)
		}
	}
}

func TestPlanPageRegenerateDiscard(t *testing.T) {
	active := &MealPlan{
		Intake: PlanIntake{Goal: "gain", Diet: "vegan", MealsPerDay: 4},
		Items: []MealPlanItem{
			{PlannedMeal: aigen.PlannedMeal{Ingredients: []nutrition.Ingredient{{Name: "Tofu"}, {Name: "rice"}}}},
			{PlannedMeal: aigen.PlannedMeal{Ingredients: []nutrition.Ingredient{{Name: "Rice"}}}},
		},
	}
	store := &fakePlanStore{profile: fullProfile(), active: active, training: true}
	plans := NewPlans(store, &replyAI{text: menu}, now)
	page, err := plans.Page(context.Background(), uuid.New())
	if err != nil || !page.HasTrainingPlan || len(page.Grocery) != 2 || page.Grocery[0] != (nutrition.GroceryLine{Name: "rice", Count: 2}) {
		t.Fatalf("page = %+v, %v", page, err)
	}
	if _, err := plans.Regenerate(context.Background(), uuid.New()); err != nil || store.saved[0].Intake.Diet != "vegan" || store.saved[0].Intake.MealsPerDay != 4 {
		t.Errorf("regenerate: %v %+v", err, store.saved)
	}
	if msg, _ := plans.Discard(context.Background(), uuid.New()); msg != "Meal plan discarded." || store.archived != 1 {
		t.Errorf("discard = %q", msg)
	}
	store.active = nil
	if _, err := plans.Regenerate(context.Background(), uuid.New()); message(err) != "No meal plan to regenerate" {
		t.Errorf("regenerate without plan: %v", err)
	}
	if page, _ := plans.Page(context.Background(), uuid.New()); page.Plan != nil || page.Grocery == nil {
		t.Errorf("empty page = %+v", page)
	}
}
