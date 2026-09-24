package nutrition

import (
	"math"
	"testing"
)

func TestPortion(t *testing.T) {
	chicken := Per100g{Kcal: 165, ProteinG: 31, CarbsG: 0, FatG: 3.6, SugarG: 0, FiberG: 0, SodiumMg: 74}
	cases := []struct {
		grams float64
		want  Nutrients
	}{
		{150, Nutrients{Kcal: 248, ProteinG: 46.5, FatG: 5.4, SodiumMg: 111}},
		{33, Nutrients{Kcal: 54, ProteinG: 10.2, FatG: 1.2, SodiumMg: 24}},
		{0, Nutrients{}},
	}
	for _, c := range cases {
		if got := Portion(chicken, c.grams); got != c.want {
			t.Errorf("%vg: got %+v, want %+v", c.grams, got, c.want)
		}
	}
}

func TestNonNegativeAndSum(t *testing.T) {
	for in, want := range map[float64]float64{-3: 0, 2.5: 2.5, math.NaN(): 0} {
		if got := NonNegative(in); got != want {
			t.Errorf("NonNegative(%v) = %v", in, got)
		}
	}
	got := Sum([]Nutrients{{Kcal: 100, ProteinG: 5}, {Kcal: 50, SodiumMg: 20}})
	if got != (Nutrients{Kcal: 150, ProteinG: 5, SodiumMg: 20}) {
		t.Errorf("Sum = %+v", got)
	}
}
