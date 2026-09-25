package aigen

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
)

// ErrMealPlanUnavailable is the meal plan's failure (AI down or an unreadable
// answer).
var ErrMealPlanUnavailable = errors.New("AI is temporarily unavailable — try again later")

// MealPlanIntake is what the weekly menu is designed from; targets are
// computed beforehand (domain/nutrition.ComputeTargets).
type MealPlanIntake struct {
	Goal         string
	Diet         string
	Allergies    []string
	Dislikes     []string
	MealsPerDay  int
	Targets      nutrition.Targets
	BodyAnalysis *string
	Country      *string
}

// PlannedMeal is one meal of the generated week. JSON keys match
// meal_plan_items.
type PlannedMeal struct {
	DayOfWeek   int                    `json:"day_of_week"` // 0=Sun … 6=Sat
	MealType    string                 `json:"meal_type"`
	Title       string                 `json:"title"`
	Ingredients []nutrition.Ingredient `json:"ingredients"`
	Recipe      string                 `json:"recipe"`
	VideoQuery  string                 `json:"video_query"`
	Kcal        float64                `json:"kcal"`
	ProteinG    float64                `json:"protein_g"`
	CarbsG      float64                `json:"carbs_g"`
	FatG        float64                `json:"fat_g"`
	SugarG      float64                `json:"sugar_g"`
	FiberG      float64                `json:"fiber_g"`
	SodiumMg    float64                `json:"sodium_mg"`
}

var mealPlanSchema = Schema{
	Type: Object,
	Properties: []Property{
		{"items", Schema{Type: Array, Items: &Schema{
			Type: Object,
			Properties: []Property{
				{"day_of_week", Schema{Type: Number}},
				{"meal_type", Schema{Type: String}},
				{"title", Schema{Type: String}},
				{"ingredients", Schema{Type: Array, Items: &Schema{
					Type:       Object,
					Properties: []Property{{"name", Schema{Type: String}}, {"qty", Schema{Type: String}}},
					Required:   []string{"name"},
				}}},
				{"recipe", Schema{Type: String}},
				{"video_query", Schema{Type: String}},
				{"kcal", Schema{Type: Number}},
				{"protein_g", Schema{Type: Number}},
				{"carbs_g", Schema{Type: Number}},
				{"fat_g", Schema{Type: Number}},
				{"sugar_g", Schema{Type: Number}},
				{"fiber_g", Schema{Type: Number}},
				{"sodium_mg", Schema{Type: Number}},
			},
			Required: []string{"day_of_week", "meal_type", "title", "kcal"},
		}}},
	},
	Required: []string{"items"},
}

// MealPlanRequest asks for a 7-day menu hitting the targets.
func MealPlanRequest(in MealPlanIntake) Request {
	n := jsnum.FormatNumber
	t := in.Targets
	lines := []string{
		"Design a 7-day meal plan (day_of_week 0=Sunday … 6=Saturday) with " + n(float64(in.MealsPerDay)) + " meals per day.",
		"Each day should total roughly " + n(t.Kcal) + " kcal, " + n(t.ProteinG) + "g protein, " + n(t.CarbsG) + "g carbs, " + n(t.FatG) + "g fat.",
		"Goal: " + in.Goal + ". Diet: " + in.Diet + ".",
	}
	if len(in.Allergies) > 0 {
		lines = append(lines, "STRICTLY avoid these allergens: "+strings.Join(in.Allergies, ", ")+".")
	}
	if len(in.Dislikes) > 0 {
		lines = append(lines, "Avoid where possible: "+strings.Join(in.Dislikes, ", ")+".")
	}
	if in.BodyAnalysis != nil && *in.BodyAnalysis != "" {
		lines = append(lines, "Athlete context (consented): "+*in.BodyAnalysis)
	}
	lines = append(lines, "For every meal provide: day_of_week, meal_type (breakfast/lunch/dinner/snack), a short title, an ingredient list with quantities, 1-3 concise recipe steps, a YouTube search query for a how-to video, and the meal's macros (protein/carbs/fat/sugar/fiber in grams, sodium in mg) and kcal.")
	if in.Country != nil && *in.Country != "" {
		lines = append(lines, "The user lives in "+*in.Country+": use ingredients that are commonly available and affordable there, and prefer familiar local dishes and staple foods alongside general healthy options. Never quote prices or costs.")
	} else {
		lines = append(lines, "Keep ingredients common and affordable.")
	}
	lines = append(lines, "Vary meals across the week.")
	return Request{Prompt: strings.Join(lines, "\n"), Schema: mealPlanSchema}
}

// Meal-plan limits.
const (
	maxPlanMeals       = 40
	maxMealIngredients = 20
	maxMealKcal        = 5000
)

var planMealTypes = map[string]bool{"breakfast": true, "lunch": true, "dinner": true, "snack": true}

// ParseMealPlan keeps the well-formed meals (weekday 0–6, a known meal type, a
// title), at most 40; amounts are whole and non-negative, kcal ≤ 5000.
func ParseMealPlan(text string) ([]PlannedMeal, error) {
	var raw any
	if err := json.Unmarshal([]byte(text), &raw); err != nil || raw == nil {
		return nil, ErrMealPlanUnavailable
	}
	entries, ok := jsnum.Field(raw, "items").([]any)
	if !ok {
		return []PlannedMeal{}, nil
	}
	meals := []PlannedMeal{}
	for _, entry := range entries {
		if entry == nil {
			return nil, ErrMealPlanUnavailable // legacy threw reading null.day_of_week
		}
		if meal, ok := plannedMeal(entry); ok && len(meals) < maxPlanMeals {
			meals = append(meals, meal)
		}
	}
	return meals, nil
}

// text is String(v ?? fallback).
func text(v any, fallback string) string {
	switch v.(type) {
	case nil, jsnum.Missing:
		return fallback
	}
	return jsnum.ToString(v)
}

// whole is Math.max(0, Math.round(Number(v) || 0)).
func whole(v any) float64 {
	n := jsnum.ToNumber(v)
	if !jsnum.IsFinite(n) {
		return 0
	}
	return max(0, jsnum.Round(n))
}

func plannedMeal(entry any) (PlannedMeal, bool) {
	day := jsnum.Round(jsnum.ToNumber(jsnum.Field(entry, "day_of_week")))
	mealType := strings.ToLower(text(jsnum.Field(entry, "meal_type"), ""))
	title := jsnum.Slice(jsnum.Trim(text(jsnum.Field(entry, "title"), "")), 120)
	if !jsnum.IsFinite(day) || day < 0 || day > 6 || !planMealTypes[mealType] || title == "" {
		return PlannedMeal{}, false
	}
	return PlannedMeal{
		DayOfWeek: int(day), MealType: mealType, Title: title,
		Ingredients: ingredients(jsnum.Field(entry, "ingredients")),
		Recipe:      jsnum.Slice(text(jsnum.Field(entry, "recipe"), ""), 600),
		VideoQuery:  jsnum.Slice(text(jsnum.Field(entry, "video_query"), title), 100),
		Kcal:        min(whole(jsnum.Field(entry, "kcal")), maxMealKcal),
		ProteinG:    whole(jsnum.Field(entry, "protein_g")),
		CarbsG:      whole(jsnum.Field(entry, "carbs_g")),
		FatG:        whole(jsnum.Field(entry, "fat_g")),
		SugarG:      whole(jsnum.Field(entry, "sugar_g")),
		FiberG:      whole(jsnum.Field(entry, "fiber_g")),
		SodiumMg:    whole(jsnum.Field(entry, "sodium_mg")),
	}, true
}

// ingredients keeps named entries (80 chars, qty 40), at most 20.
func ingredients(v any) []nutrition.Ingredient {
	list, ok := v.([]any)
	if !ok {
		return []nutrition.Ingredient{}
	}
	out := []nutrition.Ingredient{}
	for _, entry := range list {
		name := jsnum.Slice(jsnum.Trim(text(jsnum.Field(entry, "name"), "")), 80)
		if name == "" || len(out) >= maxMealIngredients {
			continue
		}
		ingredient := nutrition.Ingredient{Name: name}
		if qty := jsnum.Field(entry, "qty"); truthyValue(qty) {
			ingredient.Qty = jsnum.Slice(jsnum.ToString(qty), 40)
		}
		out = append(out, ingredient)
	}
	return out
}

// truthyValue is JavaScript truthiness for decoded JSON.
func truthyValue(v any) bool {
	switch x := v.(type) {
	case nil, jsnum.Missing:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case float64:
		return x == x && x != 0
	}
	return true
}
