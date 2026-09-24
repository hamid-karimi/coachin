package quotas

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

func TestProgressMatchesLegacy(t *testing.T) {
	type tc struct {
		Quotas []Target        `json:"quotas"`
		Logs   []Log           `json:"logs"`
		Want   json.RawMessage `json:"want"`
	}
	for i, c := range golden.Load[tc](t, "quotas") {
		if equal, got := golden.Equal(t, ProgressOf(c.Quotas, c.Logs), c.Want); !equal {
			t.Errorf("case %d = %s, want %s", i, got, c.Want)
		}
	}
}
