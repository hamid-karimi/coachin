package goals

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn      string          `json:"fn"`
	Start   *float64        `json:"start"`
	Target  float64         `json:"target"`
	Current *float64        `json:"current"`
	Want    json.RawMessage `json:"want"`
}

func TestGoalsMatchLegacy(t *testing.T) {
	run := map[string]func(c tc) any{
		"GOAL_TYPE_META": func(tc) any { return TypeMeta },
		"goalProgress":   func(c tc) any { return golden.OrNull(ProgressOf(c.Start, c.Target, c.Current)) },
	}
	for _, c := range golden.Load[tc](t, "goals") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(c), c.Want); !equal {
			t.Errorf("%s(start=%v target=%v current=%v) = %s, want %s", c.Fn, c.Start, c.Target, c.Current, got, c.Want)
		}
	}
}

func TestSettle(t *testing.T) {
	f := func(v float64) *float64 { return &v }
	cases := []struct {
		name        string
		start, read *float64
		target      float64
		want        Settlement
	}{
		{"no reading", f(80), nil, 70, Keep},
		{"no start → baseline, never paid", nil, f(65), 70, SetBaseline},
		{"losing, not there yet", f(80), f(75), 70, Keep},
		{"losing, crossed", f(80), f(69.5), 70, Achieve},
		{"gaining, crossed", f(60), f(70), 70, Achieve},
		{"gaining, went the wrong way", f(60), f(55), 70, Keep},
	}
	for _, c := range cases {
		if got := Settle(c.start, c.target, c.read); got != c.want {
			t.Errorf("%s: Settle = %v, want %v", c.name, got, c.want)
		}
	}
}
