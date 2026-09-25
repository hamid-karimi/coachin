package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

// MealPlanService is the AI meal plan.
type MealPlanService interface {
	Page(ctx context.Context, userID uuid.UUID) (appnutrition.PlanPage, error)
	Generate(ctx context.Context, userID uuid.UUID, in appnutrition.PlanIntake) (string, error)
	Regenerate(ctx context.Context, userID uuid.UUID) (string, error)
	Discard(ctx context.Context, userID uuid.UUID) (string, error)
}

// IngredientBody is one ingredient line.
type IngredientBody struct {
	Name string `json:"name"`
	Qty  string `json:"qty,omitempty"`
}

// PlannedMealBody is one meal of the week.
type PlannedMealBody struct {
	ID          uuid.UUID        `json:"id"`
	DayOfWeek   int              `json:"dayOfWeek" minimum:"0" maximum:"6"`
	MealType    string           `json:"mealType" enum:"breakfast,lunch,dinner,snack"`
	Title       string           `json:"title"`
	Ingredients []IngredientBody `json:"ingredients"`
	Recipe      string           `json:"recipe"`
	VideoQuery  string           `json:"videoQuery"`
	Nutrients   NutrientsBody    `json:"nutrients"`
}

// MacroTargetsBody are the plan's daily targets.
type MacroTargetsBody struct {
	Kcal     float64 `json:"kcal"`
	ProteinG float64 `json:"proteinG"`
	CarbsG   float64 `json:"carbsG"`
	FatG     float64 `json:"fatG"`
}

// MealPlanIntakeBody is the wizard's answers.
type MealPlanIntakeBody struct {
	Goal        string   `json:"goal" enum:"lose,maintain,gain,recomp"`
	Diet        string   `json:"diet" maxLength:"100"`
	Allergies   []string `json:"allergies" maxItems:"50"`
	Dislikes    []string `json:"dislikes" maxItems:"50"`
	MealsPerDay int      `json:"mealsPerDay" doc:"3, or 4 with a snack"`
}

// MealPlanBody is the active plan.
type MealPlanBody struct {
	ID      uuid.UUID          `json:"id"`
	Targets MacroTargetsBody   `json:"targets"`
	Intake  MealPlanIntakeBody `json:"intake"`
	Meals   []PlannedMealBody  `json:"meals" doc:"By day, then plan order"`
}

// GroceryLineBody is one ingredient and how many meals use it.
type GroceryLineBody struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// MealPlanPageBody is /nutrition/plan.
type MealPlanPageBody struct {
	Plan            *MealPlanBody     `json:"plan,omitempty" doc:"Absent without an active plan"`
	Grocery         []GroceryLineBody `json:"grocery"`
	HasTrainingPlan bool              `json:"hasTrainingPlan"`
}

type mealPlanPageOutput struct {
	Body MealPlanPageBody
}

type generateMealPlanInput struct {
	Body MealPlanIntakeBody
}

func mealPlanBody(plan *appnutrition.MealPlan) *MealPlanBody {
	if plan == nil {
		return nil
	}
	t := plan.Targets
	body := &MealPlanBody{
		ID:      plan.ID,
		Targets: MacroTargetsBody{Kcal: t.Kcal, ProteinG: t.ProteinG, CarbsG: t.CarbsG, FatG: t.FatG},
		Intake: MealPlanIntakeBody{
			Goal: plan.Intake.Goal, Diet: plan.Intake.Diet, Allergies: orEmpty(plan.Intake.Allergies),
			Dislikes: orEmpty(plan.Intake.Dislikes), MealsPerDay: plan.Intake.MealsPerDay,
		},
		Meals: make([]PlannedMealBody, len(plan.Items)),
	}
	for i, item := range plan.Items {
		ingredients := make([]IngredientBody, len(item.Ingredients))
		for j, ing := range item.Ingredients {
			ingredients[j] = IngredientBody(ing)
		}
		body.Meals[i] = PlannedMealBody{
			ID: item.ID, DayOfWeek: item.DayOfWeek, MealType: item.MealType, Title: item.Title, Ingredients: ingredients,
			Recipe: item.Recipe, VideoQuery: item.VideoQuery,
			Nutrients: nutrientsBody(nutrition.Nutrients{
				Kcal: item.Kcal, ProteinG: item.ProteinG, CarbsG: item.CarbsG, FatG: item.FatG,
				SugarG: item.SugarG, FiberG: item.FiberG, SodiumMg: item.SodiumMg,
			}),
		}
	}
	return body
}

func orEmpty(list []string) []string {
	if list == nil {
		return []string{}
	}
	return list
}

func registerMealPlan(api huma.API, deps Deps) {
	svc, logger := deps.MealPlan, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	// Generation calls a paid AI model and takes a while.
	generating := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(20*time.Second, 3))}
	tags := []string{"nutrition"}

	huma.Register(api, huma.Operation{
		OperationID: "getMealPlan", Method: http.MethodGet, Path: "/nutrition/plan",
		Summary: "The active AI meal plan with its grocery list", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*mealPlanPageOutput, error) {
		userID, _ := userFrom(ctx)
		page, err := svc.Page(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := MealPlanPageBody{Plan: mealPlanBody(page.Plan), HasTrainingPlan: page.HasTrainingPlan, Grocery: make([]GroceryLineBody, len(page.Grocery))}
		for i, line := range page.Grocery {
			body.Grocery[i] = GroceryLineBody(line)
		}
		return &mealPlanPageOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "generateMealPlan", Method: http.MethodPost, Path: "/nutrition/plan",
		Summary:     "Generate a 7-day meal plan with AI (replaces the active one)",
		Description: "Targets come from the profile and weekly training days (FORMULAS.md §10); the calorie-intake goal is set to the plan's target. Takes ~15-60 s.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Middlewares: generating, Errors: []int{400, 401, 429, 502},
	}, func(ctx context.Context, in *generateMealPlanInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		message, err := svc.Generate(ctx, userID, appnutrition.PlanIntake{
			Goal: b.Goal, Diet: b.Diet, Allergies: b.Allergies, Dislikes: b.Dislikes, MealsPerDay: b.MealsPerDay,
		})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: message}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "regenerateMealPlan", Method: http.MethodPost, Path: "/nutrition/plan/regenerate",
		Summary: "Generate a new week from the active plan's answers", Tags: tags,
		DefaultStatus: http.StatusCreated, Middlewares: generating, Errors: []int{401, 404, 429, 502},
	}, func(ctx context.Context, _ *struct{}) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		message, err := svc.Regenerate(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: message}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "discardMealPlan", Method: http.MethodDelete, Path: "/nutrition/plan",
		Summary: "Discard the active meal plan (the calorie goal stays)", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		message, err := svc.Discard(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "info", Message: message}}, nil
	})
}
