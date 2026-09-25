package xp

import (
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

func TestLevelProgressMatchesLegacy(t *testing.T) {
	type tc struct {
		XP   int64    `json:"xp"`
		Want Progress `json:"want"`
	}
	for _, c := range golden.Load[tc](t, "xp") {
		if got := LevelProgress(c.XP); got != c.Want {
			t.Errorf("LevelProgress(%d) = %+v, want %+v", c.XP, got, c.Want)
		}
	}
}

func TestLevel(t *testing.T) {
	cases := map[int64]int64{0: 1, 999: 1, 1000: 2, 1999: 2, 2000: 3, 12345: 13, -1: 0}
	for total, want := range cases {
		if got := Level(total); got != want {
			t.Errorf("Level(%d) = %d, want %d", total, got, want)
		}
	}
}

func TestMultiplier(t *testing.T) {
	half, zero := 1.5, 0.0
	cases := []struct {
		raw  *float64
		want float64
	}{{nil, 1}, {&zero, 1}, {&half, 1.5}}
	for _, c := range cases {
		if got := Multiplier(c.raw); got != c.want {
			t.Errorf("Multiplier(%v) = %v, want %v", c.raw, got, c.want)
		}
	}
}

func TestEstimatedWeeklyXP(t *testing.T) {
	cases := []struct {
		multipliers []float64
		want        int64
	}{
		{nil, 0},
		{[]float64{1, 1, 1}, 180},
		{[]float64{1.2, 1}, 132},
		// Rounded once: 3 × 60.5 = 181.5 → 182 (per-session rounding would give 183).
		{[]float64{1.0083333333333333, 1.0083333333333333, 1.0083333333333333}, 182},
	}
	for _, c := range cases {
		if got := EstimatedWeeklyXP(c.multipliers); got != c.want {
			t.Errorf("EstimatedWeeklyXP(%v) = %d, want %d", c.multipliers, got, c.want)
		}
	}
}

func TestReasonLabel(t *testing.T) {
	sports := map[int64]string{1: "Running"}
	str := func(s string) *string { return &s }
	cases := []struct {
		reason *string
		want   string
	}{
		{nil, "XP earned"},
		{str(""), "XP earned"},
		{str("workout_log:1"), "Running workout"},
		{str("workout_log:9"), "Workout logged"},
		{str("workout_log:1a"), "workout log"},
		{str("streak_bonus:7"), "Streak bonus"},
		{str("goal_achieved:abc"), "goal achieved"},
		{str("plan_item_done"), "plan item done"},
	}
	for _, c := range cases {
		if got := ReasonLabel(c.reason, sports); got != c.want {
			t.Errorf("ReasonLabel(%v) = %q, want %q", c.reason, got, c.want)
		}
	}
}
