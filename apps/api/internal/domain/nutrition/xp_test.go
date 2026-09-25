package nutrition

import "testing"

func TestMealAward(t *testing.T) {
	cases := map[int]struct {
		xp     int
		capped bool
	}{0: {5, false}, 2: {5, false}, 3: {0, true}, 7: {0, true}}
	for awarded, want := range cases {
		if xp, capped := MealAward(awarded); xp != want.xp || capped != want.capped {
			t.Errorf("%d awarded: got %d/%v, want %+v", awarded, xp, capped, want)
		}
	}
}

func TestCalorieDayXP(t *testing.T) {
	goal := func(v float64) *float64 { return &v }
	cases := map[string]struct {
		target *float64
		total  float64
		meals  int
		want   int
	}{
		"on target":          {goal(2000), 2000, 3, 30},
		"exactly -10%":       {goal(2000), 1800, 2, 30},
		"exactly +10%":       {goal(2000), 2200, 2, 30},
		"just under":         {goal(2000), 1799.9, 2, 0},
		"just over":          {goal(2000), 2200.1, 2, 0},
		"odd target edge":    {goal(2345), 2110.5, 2, 30},
		"one meal":           {goal(2000), 2000, 1, 0},
		"no goal":            {nil, 2000, 3, 0},
		"nothing eaten":      {goal(2000), 0, 0, 0},
		"fractional in band": {goal(1850.5), 1700.25, 4, 30},
	}
	for name, tc := range cases {
		if got := CalorieDayXP(tc.target, tc.total, tc.meals); got != tc.want {
			t.Errorf("%s: got %d, want %d", name, got, tc.want)
		}
	}
}
