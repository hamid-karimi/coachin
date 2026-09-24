package nutrition

import (
	"slices"
	"strings"
	"time"

	"golang.org/x/text/collate"
	"golang.org/x/text/language"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// gramsPerUnit converts household units to grams; volume units assume
// roughly water density.
var gramsPerUnit = map[string]float64{
	"g": 1, "kg": 1000, "ml": 1, "l": 1000, "tsp": 5, "tbsp": 15, "cup": 240,
	"oz": 28.35, "lb": 453.6, "slice": 30, "piece": 50, "handful": 30, "serving": 100,
}

// UnitOption is one entry of the amount-unit dropdown.
type UnitOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// UnitOptions are the dropdown's units, in display order.
var UnitOptions = []UnitOption{
	{"g", "g"}, {"ml", "ml"}, {"tsp", "tsp"}, {"tbsp", "tbsp"}, {"cup", "cup"},
	{"oz", "oz"}, {"slice", "slice"}, {"piece", "piece"}, {"handful", "handful"}, {"serving", "serving"},
}

// IsUnit reports whether unit is a known food unit.
func IsUnit(unit string) bool {
	_, ok := gramsPerUnit[unit]
	return ok
}

// ToGrams converts qty of unit to grams, one decimal. Non-positive quantities
// are 0; unknown units count as grams.
func ToGrams(qty float64, unit string) float64 {
	if !jsnum.IsFinite(qty) || qty <= 0 {
		return 0
	}
	perUnit, ok := gramsPerUnit[unit]
	if !ok {
		perUnit = 1
	}
	return jsnum.Round(qty*perUnit*10) / 10
}

// MealSlot is a planned or logged meal's type and calories.
type MealSlot struct {
	MealType string  `json:"meal_type"`
	Kcal     float64 `json:"kcal"`
}

// Adherence is one date's meal adherence — numbers only, no verdicts.
type Adherence struct {
	SlotsPlanned int     `json:"slotsPlanned"`
	SlotsLogged  int     `json:"slotsLogged"`
	KcalPlanned  float64 `json:"kcalPlanned"`
	// KcalLogged includes unplanned meal types (total-intake signal).
	KcalLogged float64 `json:"kcalLogged"`
	// KcalRatio is logged / planned; nil when nothing was planned.
	KcalRatio *float64 `json:"kcalRatio"`
}

// AdherenceForDay matches planned and logged meals by meal type only.
func AdherenceForDay(planned, logged []MealSlot) Adherence {
	plannedTypes, loggedTypes := map[string]bool{}, map[string]bool{}
	var a Adherence
	for _, meal := range planned {
		plannedTypes[meal.MealType] = true
		a.KcalPlanned += meal.Kcal
	}
	for _, meal := range logged {
		loggedTypes[meal.MealType] = true
		a.KcalLogged += meal.Kcal
	}
	a.SlotsPlanned = len(plannedTypes)
	for mealType := range plannedTypes {
		if loggedTypes[mealType] {
			a.SlotsLogged++
		}
	}
	if a.KcalPlanned != 0 {
		ratio := a.KcalLogged / a.KcalPlanned
		a.KcalRatio = &ratio
	}
	return a
}

// Nutrients are summed nutrient totals.
type Nutrients struct {
	Kcal     float64 `json:"kcal"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
	SugarG   float64 `json:"sugar_g"`
	FiberG   float64 `json:"fiber_g"`
	SodiumMg float64 `json:"sodium_mg"`
}

func (n *Nutrients) add(o Nutrients) {
	n.Kcal += o.Kcal
	n.ProteinG += o.ProteinG
	n.CarbsG += o.CarbsG
	n.FatG += o.FatG
	n.SugarG += o.SugarG
	n.FiberG += o.FiberG
	n.SodiumMg += o.SodiumMg
}

func (n Nutrients) averageOver(days float64) Nutrients {
	avg := func(x float64) float64 { return jsnum.Round(x / days) }
	return Nutrients{
		avg(n.Kcal), avg(n.ProteinG), avg(n.CarbsG), avg(n.FatG),
		avg(n.SugarG), avg(n.FiberG), avg(n.SodiumMg),
	}
}

// DatedNutrients is one meal log's nutrients on its local date.
type DatedNutrients struct {
	Date string `json:"date"`
	Nutrients
}

// DailyPoint is one day of a trend series.
type DailyPoint struct {
	Date   string    `json:"date"`
	Totals Nutrients `json:"totals"`
}

// Period summarizes a window of days.
type Period struct {
	// Series has one point per day, oldest first; unlogged days are zero.
	Series     []DailyPoint `json:"series"`
	DaysLogged int          `json:"daysLogged"`
	TotalDays  int          `json:"totalDays"`
	// Avg is over logged days only, so gaps don't drag it toward zero.
	Avg Nutrients `json:"avg"`
}

// SummarizePeriod covers the days-long window ending at today (YYYY-MM-DD,
// inclusive).
func SummarizePeriod(rows []DatedNutrients, days int, today string) (Period, error) {
	end, err := time.Parse(dates.YMDLayout, today)
	if err != nil {
		return Period{}, err
	}
	byDay := map[string]*Nutrients{}
	for _, row := range rows {
		totals, ok := byDay[row.Date]
		if !ok {
			totals = &Nutrients{}
			byDay[row.Date] = totals
		}
		totals.add(row.Nutrients)
	}

	period := Period{Series: make([]DailyPoint, 0, days), TotalDays: days}
	var sum Nutrients
	for offset := days - 1; offset >= 0; offset-- {
		date := dates.ToYMD(end.AddDate(0, 0, -offset))
		point := DailyPoint{Date: date}
		if totals, ok := byDay[date]; ok {
			period.DaysLogged++
			sum.add(*totals)
			point.Totals = *totals
		}
		period.Series = append(period.Series, point)
	}
	if period.DaysLogged > 0 {
		period.Avg = sum.averageOver(float64(period.DaysLogged))
	}
	return period, nil
}

// Ingredient is one line of a planned meal's ingredient list.
type Ingredient struct {
	Name string `json:"name"`
	Qty  string `json:"qty,omitempty"`
}

// PlanItem is the part of a meal-plan item the grocery list needs.
type PlanItem struct {
	Ingredients []Ingredient `json:"ingredients"`
}

// GroceryLine is one de-duplicated ingredient and how many meals use it.
type GroceryLine struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// BuildGroceryList merges ingredients case-insensitively (the first spelling
// wins) and sorts them the way a person would (locale-aware, like
// JavaScript's localeCompare).
func BuildGroceryList(items []PlanItem) []GroceryLine {
	byKey := map[string]*GroceryLine{}
	lines := []*GroceryLine{}
	for _, item := range items {
		for _, ingredient := range item.Ingredients {
			name := jsnum.Trim(ingredient.Name)
			if name == "" {
				continue
			}
			key := strings.ToLower(name)
			if line, ok := byKey[key]; ok {
				line.Count++
				continue
			}
			line := &GroceryLine{Name: name, Count: 1}
			byKey[key] = line
			lines = append(lines, line)
		}
	}

	collator := collate.New(language.Und)
	slices.SortStableFunc(lines, func(a, b *GroceryLine) int {
		return collator.CompareString(a.Name, b.Name)
	})
	out := make([]GroceryLine, len(lines))
	for i, line := range lines {
		out[i] = *line
	}
	return out
}
