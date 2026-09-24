package scorecard

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn       string          `json:"fn"`
	Items    []Item          `json:"items"`
	Logs     []*SessionLog   `json:"logs"`
	Current  Week            `json:"current"`
	Previous *Week           `json:"previous"`
	Weeks    [][]*SessionLog `json:"weeks"`
	Want     json.RawMessage `json:"want"`
}

func TestScorecardMatchesLegacy(t *testing.T) {
	run := map[string]func(c tc) any{
		"computeWeekScorecard": func(c tc) any { return ComputeWeek(c.Items, c.Logs) },
		"decideWeek":           func(c tc) any { return Decide(c.Current, c.Previous) },
		"detectStalledLifts":   func(c tc) any { return StalledLifts(c.Weeks) },
	}
	for i, c := range golden.Load[tc](t, "scorecard") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(c), c.Want); !equal {
			t.Errorf("case %d %s =\n  %s\nwant\n  %s", i, c.Fn, got, c.Want)
		}
	}
}
