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
