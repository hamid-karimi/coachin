package nutrition

import (
	"math"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// MealTypes are the meal slots a log belongs to.
var MealTypes = map[string]bool{"breakfast": true, "lunch": true, "dinner": true, "snack": true}

// Meal-entry limits (the meal_logs CHECK allows up to 5000 kcal).
const (
	MaxPortionGrams = 5000
	MaxMealKcal     = 5000
)

// Per100g is a food's nutrients per 100 g; Kcal is per 100 g too.
type Per100g Nutrients

// Portion scales a food to grams with the logging rounding: kcal and sodium
// to whole numbers, everything else to 0.1.
func Portion(food Per100g, grams float64) Nutrients {
	factor := grams / 100
	tenth := func(x float64) float64 { return jsnum.Round(x*factor*10) / 10 }
	return Nutrients{
		Kcal:     jsnum.Round(food.Kcal * factor),
		ProteinG: tenth(food.ProteinG),
		CarbsG:   tenth(food.CarbsG),
		FatG:     tenth(food.FatG),
		SugarG:   tenth(food.SugarG),
		FiberG:   tenth(food.FiberG),
		SodiumMg: jsnum.Round(food.SodiumMg * factor),
	}
}

// NonNegative is max(0, x) that also turns NaN into 0 (JavaScript's
// Math.max(0, Number(x) || 0)).
func NonNegative(x float64) float64 {
	if math.IsNaN(x) {
		return 0
	}
	return math.Max(0, x)
}

// Sum adds nutrients.
func Sum(items []Nutrients) Nutrients {
	var total Nutrients
	for _, n := range items {
		total.add(n)
	}
	return total
}

// USDAFood is a USDA FoodData Central food.
type USDAFood struct {
	FdcID int64
	Name  string
	Per100g
}
