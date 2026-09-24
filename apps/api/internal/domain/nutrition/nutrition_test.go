package nutrition

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

func TestTargetsMatchLegacy(t *testing.T) {
	type tc struct {
		Input TargetInputs    `json:"input"`
		Can   bool            `json:"can"`
		Want  json.RawMessage `json:"want"`
	}
	for i, c := range golden.Load[tc](t, "nutrition-targets") {
		if got := CanComputeTargets(c.Input); got != c.Can {
			t.Errorf("case %d CanComputeTargets = %v, want %v", i, got, c.Can)
		}
		if equal, got := golden.Equal(t, golden.OrNull(ComputeTargets(c.Input)), c.Want); !equal {
			t.Errorf("case %d ComputeTargets = %s, want %s", i, got, c.Want)
		}
	}
}

type tc struct {
	Fn      string           `json:"fn"`
	Unit    string           `json:"unit"`
	Qty     float64          `json:"qty"`
	Planned []MealSlot       `json:"planned"`
	Logged  []MealSlot       `json:"logged"`
	Rows    []DatedNutrients `json:"rows"`
	Days    int              `json:"days"`
	Today   string           `json:"today"`
	Items   []PlanItem       `json:"items"`
	Want    json.RawMessage  `json:"want"`
}

func TestNutritionMatchesLegacy(t *testing.T) {
	run := map[string]func(t *testing.T, c tc) any{
		"FOOD_UNIT_OPTIONS":   func(*testing.T, tc) any { return UnitOptions },
		"isFoodUnit":          func(_ *testing.T, c tc) any { return IsUnit(c.Unit) },
		"toGrams":             func(_ *testing.T, c tc) any { return ToGrams(c.Qty, c.Unit) },
		"mealAdherenceForDay": func(_ *testing.T, c tc) any { return AdherenceForDay(c.Planned, c.Logged) },
		"summarizePeriod": func(t *testing.T, c tc) any {
			period, err := SummarizePeriod(c.Rows, c.Days, c.Today)
			if err != nil {
				t.Fatal(err)
			}
			return period
		},
		"buildGroceryList": func(_ *testing.T, c tc) any { return BuildGroceryList(c.Items) },
	}
	for i, c := range golden.Load[tc](t, "nutrition") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(t, c), c.Want); !equal {
			t.Errorf("case %d %s(unit=%q qty=%v) =\n  %s\nwant\n  %s", i, c.Fn, c.Unit, c.Qty, got, c.Want)
		}
	}
}
