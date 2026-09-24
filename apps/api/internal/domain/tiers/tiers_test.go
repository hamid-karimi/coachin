package tiers

import (
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn     string  `json:"fn"`
	XP     int64   `json:"xp"`
	League *string `json:"league"`
	Want   Tier    `json:"want"`
}

func TestTiersMatchLegacy(t *testing.T) {
	run := map[string]func(tc) Tier{
		"leagueTierFromXp": func(c tc) Tier { return FromXP(c.XP) },
		"tierFromLeague":   func(c tc) Tier { return FromLeague(c.League) },
	}
	for _, c := range golden.Load[tc](t, "tiers") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if got := fn(c); got != c.Want {
			t.Errorf("%s(%+v) = %q, want %q", c.Fn, c, got, c.Want)
		}
	}
}
