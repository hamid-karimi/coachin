package progress

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn            string          `json:"fn"`
	Logs          []SessionLog    `json:"logs"`
	Today         time.Time       `json:"today"`
	Weeks         int             `json:"weeks"`
	MinSessions   int             `json:"minSessions"`
	MaxExercises  int             `json:"maxExercises"`
	Measurements  []Measurement   `json:"measurements"`
	CurrentStreak int             `json:"currentStreak"`
	WeekLogCount  int             `json:"weekLogCount"`
	LastPhotoAt   *time.Time      `json:"lastPhotoAt"`
	Want          json.RawMessage `json:"want"`
}

func TestProgressMatchesLegacy(t *testing.T) {
	utc := time.UTC
	run := map[string]func(c tc) any{
		"weeklyVolume":       func(c tc) any { return WeeklyVolume(c.Logs, c.Today.In(utc), c.Weeks) },
		"weeklyKm":           func(c tc) any { return WeeklyKm(c.Logs, c.Today.In(utc), c.Weeks) },
		"exerciseTopSets":    func(c tc) any { return ExerciseTopSets(c.Logs, c.MinSessions, c.MaxExercises, utc) },
		"weightSeries":       func(c tc) any { return WeightSeries(c.Measurements, utc) },
		"isProgressPhotoDue": func(c tc) any { return IsPhotoDue(c.CurrentStreak, c.WeekLogCount, c.LastPhotoAt, c.Today) },
	}
	for i, c := range golden.Load[tc](t, "progress") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(c), c.Want); !equal {
			t.Errorf("case %d %s =\n  %s\nwant\n  %s", i, c.Fn, got, c.Want)
		}
	}
}
