package xp

import (
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

func TestLevelProgressMatchesLegacy(t *testing.T) {
	type tc struct {
		XP   int64    `json:"xp"`
		Want Progress `json:"want"`
	}
	for _, c := range golden.Load[tc](t, "xp") {
		if got := LevelProgress(c.XP); got != c.Want {
			t.Errorf("LevelProgress(%d) = %+v, want %+v", c.XP, got, c.Want)
		}
	}
}

func TestLevel(t *testing.T) {
	cases := map[int64]int64{0: 1, 999: 1, 1000: 2, 1999: 2, 2000: 3, 12345: 13, -1: 0}
	for total, want := range cases {
		if got := Level(total); got != want {
			t.Errorf("Level(%d) = %d, want %d", total, got, want)
		}
	}
}
