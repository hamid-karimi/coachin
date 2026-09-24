package streak

import (
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

func TestNextMatchesLegacySequences(t *testing.T) {
	type tc struct {
		Start  State   `json:"start"`
		Days   []Day   `json:"days"`
		States []State `json:"states"`
	}
	for i, c := range golden.Load[tc](t, "streak") {
		state := c.Start
		for day, outcome := range c.Days {
			state = Next(state, outcome)
			if state != c.States[day] {
				t.Fatalf("sequence %d day %d: got %+v, want %+v", i, day, state, c.States[day])
			}
		}
	}
}
