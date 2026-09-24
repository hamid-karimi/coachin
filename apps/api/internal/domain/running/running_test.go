package running

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn       string          `json:"fn"`
	D1       float64         `json:"d1"`
	T1       float64         `json:"t1"`
	D2       float64         `json:"d2"`
	Value    json.RawMessage `json:"value"`
	Seconds  float64         `json:"seconds"`
	Target   string          `json:"target"`
	CustomKm *float64        `json:"customKm"`
	PBs      PBs             `json:"pbs"`
	TargetKm float64         `json:"targetKm"`
	Want     json.RawMessage `json:"want"`
}

func TestRunningMatchesLegacy(t *testing.T) {
	run := map[string]func(t *testing.T, c tc) any{
		"riegelSeconds": func(_ *testing.T, c tc) any { return RiegelSeconds(c.D1, c.T1, c.D2) },
		"parseTimeToSeconds": func(t *testing.T, c tc) any {
			return golden.OrNull(ParseTimeToSeconds(golden.Decode[string](t, c.Value)))
		},
		"formatSeconds": func(_ *testing.T, c tc) any { return FormatSeconds(c.Seconds) },
		"clampBaseWeeks": func(t *testing.T, c tc) any {
			return ClampBaseWeeks(golden.Decode[*float64](t, c.Value))
		},
		"raceDistanceKm": func(_ *testing.T, c tc) any {
			return golden.OrNull(RaceDistanceKm(c.Target, c.CustomKm))
		},
		"suggestGoalForDistance": func(_ *testing.T, c tc) any {
			return golden.OrNull(SuggestGoalForDistance(c.PBs, c.TargetKm))
		},
	}
	for _, c := range golden.Load[tc](t, "running") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(t, c), c.Want); !equal {
			t.Errorf("%s(%+v) = %s, want %s", c.Fn, c, got, c.Want)
		}
	}
}
