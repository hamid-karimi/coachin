package profile

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn      string          `json:"fn"`
	Params  ScheduleRequest `json:"params"`
	Code    *string         `json:"code"`
	Profile *string         `json:"profile"`
	Header  *string         `json:"header"`
	Want    json.RawMessage `json:"want"`
}

func TestProfileMatchesLegacy(t *testing.T) {
	run := map[string]func(c tc) any{
		"buildScheduleInserts": func(c tc) any { return ScheduleRows(c.Params) },
		"countryNameFromCode": func(c tc) any {
			if c.Code == nil {
				return nil
			}
			return golden.OrNull(CountryName(*c.Code))
		},
		"resolveUserCountry": func(c tc) any { return golden.OrNull(ResolveCountry(c.Profile, c.Header)) },
	}
	for i, c := range golden.Load[tc](t, "profile") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(c), c.Want); !equal {
			t.Errorf("case %d %s(code=%v) = %s, want %s", i, c.Fn, c.Code, got, c.Want)
		}
	}
}
