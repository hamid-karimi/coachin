package supplements

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn            string          `json:"fn"`
	Schedule      Schedule        `json:"schedule"`
	Weekday       int             `json:"weekday"`
	IsTrainingDay bool            `json:"isTrainingDay"`
	CreatedYMD    string          `json:"createdYmd"`
	Window        []WindowDay     `json:"window"`
	Taken         []string        `json:"taken"`
	Want          json.RawMessage `json:"want"`
}

func TestSupplementsMatchLegacy(t *testing.T) {
	run := map[string]func(c tc) any{
		"scheduleLabel": func(c tc) any { return Label(c.Schedule) },
		"isSupplementDue": func(c tc) any {
			return IsDue(c.Schedule, Day{Weekday: c.Weekday, IsTrainingDay: c.IsTrainingDay})
		},
		"supplementTakenRate": func(c tc) any {
			taken := map[string]bool{}
			for _, ymd := range c.Taken {
				taken[ymd] = true
			}
			return TakenRateOver(c.Schedule, c.CreatedYMD, c.Window, taken)
		},
	}
	for i, c := range golden.Load[tc](t, "supplements") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(c), c.Want); !equal {
			t.Errorf("case %d %s(%+v) = %s, want %s", i, c.Fn, c.Schedule, got, c.Want)
		}
	}
}
