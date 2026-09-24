package activity

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn         string          `json:"fn"`
	Raw        json.RawMessage `json:"raw"`
	Activities []Summary       `json:"activities"`
	Existing   []string        `json:"existing"`
	Today      string          `json:"today"`
	Want       json.RawMessage `json:"want"`
}

func TestActivityMatchesLegacy(t *testing.T) {
	run := map[string]func(t *testing.T, c tc) any{
		"sanitizeActivities": func(t *testing.T, c tc) any { return Sanitize(golden.Decode[any](t, c.Raw)) },
		"splitImportableActivities": func(t *testing.T, c tc) any {
			split, err := SplitImportable(c.Activities, c.Existing, c.Today)
			if err != nil {
				t.Fatal(err)
			}
			return split
		},
	}
	for i, c := range golden.Load[tc](t, "activity-import") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(t, c), c.Want); !equal {
			t.Errorf("case %d %s =\n  %s\nwant\n  %s", i, c.Fn, got, c.Want)
		}
	}
}
