package workout

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn        string          `json:"fn"`
	Raw       json.RawMessage `json:"raw"`
	Exercises []Exercise      `json:"exercises"`
	Kg        float64         `json:"kg"`
	Text      string          `json:"text"`
	Want      json.RawMessage `json:"want"`
}

func TestWorkoutMatchesLegacy(t *testing.T) {
	run := map[string]func(t *testing.T, c tc) any{
		"normalizeLoggedExercises": func(t *testing.T, c tc) any {
			return NormalizeLoggedExercises(golden.Decode[any](t, c.Raw))
		},
		"totalVolumeKg":     func(_ *testing.T, c tc) any { return TotalVolumeKg(c.Exercises) },
		"volumeEquivalence": func(_ *testing.T, c tc) any { return golden.OrNull(VolumeEquivalence(c.Kg)) },
		"parsePrescription": func(_ *testing.T, c tc) any { return ParsePrescription(c.Text) },
	}
	for _, c := range golden.Load[tc](t, "workout-sets") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(t, c), c.Want); !equal {
			t.Errorf("%s(raw=%s text=%q kg=%v) =\n  %s\nwant\n  %s", c.Fn, c.Raw, c.Text, c.Kg, got, c.Want)
		}
	}
}
