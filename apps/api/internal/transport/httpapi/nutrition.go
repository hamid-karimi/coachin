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

// NutritionService is meal logging.
type NutritionService interface {
	Day(ctx context.Context, userID uuid.UUID) (appnutrition.Day, error)
	SearchFoods(ctx context.Context, userID uuid.UUID, q string) ([]appnutrition.Food, error)
	SearchUSDA(ctx context.Context, q string) ([]nutrition.USDAFood, error)
	LogMeal(ctx context.Context, userID uuid.UUID, in appnutrition.MealInput) (string, error)
	DeleteMeal(ctx context.Context, userID, id uuid.UUID) (string, error)
}

// NutrientsBody are calories and nutrients (kcal and sodium whole, the rest to 0.1).
type NutrientsBody struct {
	Kcal     float64 `json:"kcal"`
	ProteinG float64 `json:"proteinG"`
	CarbsG   float64 `json:"carbsG"`
	FatG     float64 `json:"fatG"`
	SugarG   float64 `json:"sugarG"`
	FiberG   float64 `json:"fiberG"`
	SodiumMg float64 `json:"sodiumMg"`
}

func nutrientsBody(n nutrition.Nutrients) NutrientsBody { return NutrientsBody(n) }

// MealBody is a logged meal.
type MealBody struct {
	ID          uuid.UUID     `json:"id"`
	MealType    string        `json:"mealType" enum:"breakfast,lunch,dinner,snack"`
	Name        *string       `json:"name"`
	QuantityG   *float64      `json:"quantityG"`
	EntryMethod string        `json:"entryMethod" enum:"search,photo,manual"`
	Nutrients   NutrientsBody `json:"nutrients"`
}

// TrendPointBody is one day of a trend.
type TrendPointBody struct {
	Date   string        `json:"date" format:"date"`
	Totals NutrientsBody `json:"totals"`
}

// TrendBody summarizes a window of days.
type TrendBody struct {
	Series     []TrendPointBody `json:"series" doc:"One point per day, oldest first; unlogged days are zero"`
	DaysLogged int              `json:"daysLogged"`
	TotalDays  int              `json:"totalDays"`
	Avg        NutrientsBody    `json:"avg" doc:"Averaged over logged days only"`
}

// NutritionDayBody is the nutrition page.
type NutritionDayBody struct {
	Date        string        `json:"date" format:"date"`
	Target      *float64      `json:"target" doc:"Active calorie-intake goal (kcal/day)"`
	Meals       []MealBody    `json:"meals"`
	Totals      NutrientsBody `json:"totals"`
	Week        TrendBody     `json:"week"`
	Month       TrendBody     `json:"month"`
	USDAEnabled bool          `json:"usdaEnabled"`
}

// FoodBody is a local food (per 100 g).
type FoodBody struct {
	ID      uuid.UUID     `json:"id"`
	Name    string        `json:"name"`
	Source  string        `json:"source" enum:"seed,usda,custom"`
	Per100g NutrientsBody `json:"per100g"`
}

// USDAFoodBody is a FoodData Central match (per 100 g).
type USDAFoodBody struct {
	FdcID   int64         `json:"fdcId"`
	Name    string        `json:"name"`
	Per100g NutrientsBody `json:"per100g"`
}

type nutritionDayOutput struct {
	Body NutritionDayBody
}

type foodSearchInput struct {
	Q string `query:"q" maxLength:"200" doc:"At least 2 characters"`
}

type foodsOutput struct {
	Body []FoodBody
}

type usdaFoodsOutput struct {
	Body []USDAFoodBody
}

type logMealInput struct {
	Body struct {
		MealType  string     `json:"mealType" enum:"breakfast,lunch,dinner,snack"`
		FoodID    *uuid.UUID `json:"foodId,omitempty" doc:"A local food, with quantityG"`
		USDAFdcID *int64     `json:"usdaFdcId,omitempty" doc:"A USDA food (re-read from USDA), with quantityG"`
		QuantityG float64    `json:"quantityG,omitempty" doc:"Grams (0–5000]"`
		Manual    *struct {
			Name     string  `json:"name" maxLength:"500"`
			Kcal     float64 `json:"kcal"`
			ProteinG float64 `json:"proteinG,omitempty"`
			CarbsG   float64 `json:"carbsG,omitempty"`
			FatG     float64 `json:"fatG,omitempty"`
		} `json:"manual,omitempty" doc:"A hand-entered meal when no food is picked"`
	}
}

func trendBody(p nutrition.Period) TrendBody {
	body := TrendBody{Series: make([]TrendPointBody, len(p.Series)), DaysLogged: p.DaysLogged, TotalDays: p.TotalDays, Avg: nutrientsBody(p.Avg)}
	for i, point := range p.Series {
		body.Series[i] = TrendPointBody{Date: point.Date, Totals: nutrientsBody(point.Totals)}
	}
	return body
}

func registerNutrition(api huma.API, deps Deps) {
	svc, logger := deps.Nutrition, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	// USDA's key is shared by everyone (1000 requests/hour).
	usdaLimited := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 6))}
	// Logging can reach USDA too (a USDA pick is re-read there).
	logging := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 10))}
	tags := []string{"nutrition"}

	huma.Register(api, huma.Operation{
		OperationID: "getNutritionDay", Method: http.MethodGet, Path: "/nutrition/day",
		Summary: "Today's meals and totals against the calorie goal, with 7- and 30-day trends",
		Tags:    tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*nutritionDayOutput, error) {
		userID, _ := userFrom(ctx)
		day, err := svc.Day(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := NutritionDayBody{
			Date: day.Date, Target: day.Target, Meals: make([]MealBody, len(day.Meals)), Totals: nutrientsBody(day.Totals),
			Week: trendBody(day.Week), Month: trendBody(day.Month), USDAEnabled: day.USDAEnabled,
		}
		for i, m := range day.Meals {
			body.Meals[i] = MealBody{
				ID: m.ID, MealType: m.MealType, Name: m.Name, QuantityG: m.QuantityG, EntryMethod: m.EntryMethod,
				Nutrients: nutrientsBody(m.Nutrients),
			}
		}
		return &nutritionDayOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "searchFoods", Method: http.MethodGet, Path: "/foods",
		Summary: "Search the local foods table (up to 8)", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, in *foodSearchInput) (*foodsOutput, error) {
		userID, _ := userFrom(ctx)
		foods, err := svc.SearchFoods(ctx, userID, in.Q)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := make([]FoodBody, len(foods))
		for i, f := range foods {
			body[i] = FoodBody{ID: f.ID, Name: f.Name, Source: f.Source, Per100g: NutrientsBody(f.Per100g)}
		}
		return &foodsOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "searchUsdaFoods", Method: http.MethodGet, Path: "/foods/usda",
		Summary:     "Search USDA FoodData Central (up to 6, on request only)",
		Description: "502 when USDA is not configured or fails.",
		Tags:        tags, Middlewares: usdaLimited, Errors: []int{401, 429, 502},
	}, func(ctx context.Context, in *foodSearchInput) (*usdaFoodsOutput, error) {
		foods, err := svc.SearchUSDA(ctx, in.Q)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := make([]USDAFoodBody, len(foods))
		for i, f := range foods {
			body[i] = USDAFoodBody{FdcID: f.FdcID, Name: f.Name, Per100g: NutrientsBody(f.Per100g)}
		}
		return &usdaFoodsOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "logMeal", Method: http.MethodPost, Path: "/meals",
		Summary:     "Log a meal (search, USDA, or manual)",
		Description: "+5 XP for each of the first 3 meals a day; also settles yesterday's +30 calorie-goal bonus.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Middlewares: logging, Errors: []int{400, 401, 404, 429, 502},
	}, func(ctx context.Context, in *logMealInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		input := appnutrition.MealInput{MealType: b.MealType, FoodID: b.FoodID, USDAFdcID: b.USDAFdcID, QuantityG: b.QuantityG}
		if m := b.Manual; m != nil {
			input.Manual = &appnutrition.ManualMeal{Name: m.Name, Kcal: m.Kcal, ProteinG: m.ProteinG, CarbsG: m.CarbsG, FatG: m.FatG}
		}
		message, err := svc.LogMeal(ctx, userID, input)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: message}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deleteMeal", Method: http.MethodDelete, Path: "/meals/{id}",
		Summary: "Remove a meal (its meal XP is given back)", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		message, err := svc.DeleteMeal(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "info", Message: message}}, nil
	})
}
