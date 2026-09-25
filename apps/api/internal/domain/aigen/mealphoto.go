package aigen

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// ErrEstimateUnavailable is the photo estimate's failure (AI down or an
// unreadable answer).
var ErrEstimateUnavailable = errors.New("AI estimation is temporarily unavailable — try again later")

// EstimateItem is one food the AI saw, for its portion (not per 100 g).
// JSON keys match meal_logs.photo_estimate.
type EstimateItem struct {
	Name         string  `json:"name"`
	EstQuantityG float64 `json:"est_quantity_g"`
	EstKcal      float64 `json:"est_kcal"`
	ProteinG     float64 `json:"protein_g"`
	CarbsG       float64 `json:"carbs_g"`
	FatG         float64 `json:"fat_g"`
	SugarG       float64 `json:"sugar_g"`
	FiberG       float64 `json:"fiber_g"`
	SodiumMg     float64 `json:"sodium_mg"`
}

var mealPhotoSchema = Schema{
	Type: Object,
	Properties: []Property{
		{"items", Schema{Type: Array, Items: &Schema{
			Type: Object,
			Properties: []Property{
				{"name", Schema{Type: String}},
				{"est_quantity_g", Schema{Type: Number}},
				{"est_kcal", Schema{Type: Number}},
				{"protein_g", Schema{Type: Number}},
				{"carbs_g", Schema{Type: Number}},
				{"fat_g", Schema{Type: Number}},
				{"sugar_g", Schema{Type: Number}},
				{"fiber_g", Schema{Type: Number}},
				{"sodium_mg", Schema{Type: Number}},
			},
			Required: []string{"name", "est_quantity_g", "est_kcal"},
		}}},
	},
	Required: []string{"items"},
}

// MealPhotoRequest asks for the items in 1–3 photos of the same meal, with the
// athlete's optional hint and country.
func MealPhotoRequest(images []Image, hint, country *string) Request {
	lines := []string{"Identify the food items in this meal photo."}
	if len(images) > 1 {
		lines[0] = "These " + strconv.Itoa(len(images)) + " photos show the SAME meal — different angles or a packaging/nutrition-label shot. " +
			"Merge them into ONE list of items with no duplicates; use the extra angles to judge portion sizes, and when a nutrition label is visible prefer the label's data over visual estimation."
	}
	lines = append(lines, "For each item estimate the portion in grams and, for THAT portion (not per 100g): calories, protein, carbs, fat, sugar, fiber (all in grams) and sodium (in mg). If it is not food, return an empty items array.")
	if hint != nil && *hint != "" {
		lines = append(lines, `The user says: "`+*hint+`".`)
	}
	if country != nil && *country != "" {
		lines = append(lines, "The user is in "+*country+" — consider dishes and portion conventions common there when identifying the food.")
	}
	return Request{Prompt: strings.Join(lines, "\n"), Schema: mealPhotoSchema, Images: images}
}

// Estimate limits.
const (
	maxEstimateItems = 10
	maxItemKcal      = 3000
	maxItemName      = 100
)

// ParseMealEstimate reads the answer: at most 10 items, amounts rounded and
// clamped (portion 100 g when missing, ≤ 3000 kcal), zero-kcal items dropped.
// An empty list means no food was recognized.
func ParseMealEstimate(text string) ([]EstimateItem, error) {
	var raw any
	if err := json.Unmarshal([]byte(text), &raw); err != nil || raw == nil {
		return nil, ErrEstimateUnavailable
	}
	entries, ok := jsnum.Field(raw, "items").([]any)
	if !ok {
		return []EstimateItem{}, nil
	}
	items := []EstimateItem{}
	for _, entry := range entries[:min(len(entries), maxEstimateItems)] {
		if entry == nil {
			return nil, ErrEstimateUnavailable // legacy threw reading null.name
		}
		item := estimateItem(entry)
		if item.EstKcal > 0 {
			items = append(items, item)
		}
	}
	return items, nil
}

func estimateItem(entry any) EstimateItem {
	name := "Food item"
	switch v := jsnum.Field(entry, "name").(type) {
	case nil, jsnum.Missing:
	default:
		name = jsnum.ToString(v)
	}
	qty := jsnum.ToNumber(jsnum.Field(entry, "est_quantity_g"))
	if !jsnum.IsFinite(qty) || qty <= 0 {
		qty = 100
	} else {
		qty = jsnum.Round(qty)
	}
	kcal := jsnum.ToNumber(jsnum.Field(entry, "est_kcal"))
	if !jsnum.IsFinite(kcal) || kcal < 0 {
		kcal = 0
	} else {
		kcal = min(jsnum.Round(kcal), maxItemKcal)
	}
	amount := func(key string) float64 {
		n := jsnum.ToNumber(jsnum.Field(entry, key))
		if !jsnum.IsFinite(n) { // Number(x) || 0
			n = 0
		}
		return max(0, jsnum.Round(n))
	}
	return EstimateItem{
		Name: jsnum.Slice(name, maxItemName), EstQuantityG: qty, EstKcal: kcal,
		ProteinG: amount("protein_g"), CarbsG: amount("carbs_g"), FatG: amount("fat_g"),
		SugarG: amount("sugar_g"), FiberG: amount("fiber_g"), SodiumMg: amount("sodium_mg"),
	}
}
