package dates

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type tc struct {
	Fn         string          `json:"fn"`
	CreatedAt  string          `json:"createdAt"`
	Date       json.RawMessage `json:"date"`
	Timestamp  string          `json:"timestamp"`
	Now        string          `json:"now"`
	WeeksTotal int             `json:"weeksTotal"`
	Week       int             `json:"week"`
	DayOfWeek  int             `json:"dayOfWeek"`
	Want       json.RawMessage `json:"want"`
}

// instant parses a vector timestamp into the API's zone (UTC).
func instant(t *testing.T, s string) time.Time {
	t.Helper()
	v, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		t.Fatalf("parse %q: %v", s, err)
	}
	return v.In(time.UTC)
}

func TestDatesMatchLegacy(t *testing.T) {
	run := map[string]func(t *testing.T, c tc) any{
		"planWeekForDate": func(t *testing.T, c tc) any {
			return PlanWeekForDate(instant(t, c.CreatedAt), instant(t, golden.Decode[string](t, c.Date)))
		},
		"planWeekOf": func(t *testing.T, c tc) any {
			return PlanWeekOf(instant(t, c.CreatedAt), c.WeeksTotal, instant(t, c.Now))
		},
		"lastElapsedPlanWeek": func(t *testing.T, c tc) any {
			return LastElapsedPlanWeek(instant(t, c.CreatedAt), c.WeeksTotal, instant(t, c.Now))
		},
		"weeksSince": func(t *testing.T, c tc) any {
			return WeeksSince(instant(t, c.Timestamp), instant(t, c.Now))
		},
		"planItemDate": func(t *testing.T, c tc) any {
			return ToYMD(PlanItemDate(instant(t, c.CreatedAt), c.Week, c.DayOfWeek))
		},
		"mondayOf": func(t *testing.T, c tc) any {
			return ToYMD(MondayOf(instant(t, golden.Decode[string](t, c.Date))))
		},
		"daysUntil": func(t *testing.T, c tc) any {
			return golden.OrNull(DaysUntil(golden.Decode[string](t, c.Date), instant(t, c.Now)))
		},
		"yearsSince": func(t *testing.T, c tc) any {
			ymd := golden.Decode[*string](t, c.Date)
			if ymd == nil {
				return nil
			}
			return golden.OrNull(YearsSince(*ymd, instant(t, c.Now)))
		},
	}
	for _, c := range golden.Load[tc](t, "dates") {
		fn, ok := run[c.Fn]
		if !ok {
			t.Fatalf("no Go port for %q", c.Fn)
		}
		if equal, got := golden.Equal(t, fn(t, c), c.Want); !equal {
			t.Errorf("%s(created=%s date=%s now=%s week=%d dow=%d total=%d) = %s, want %s",
				c.Fn, c.CreatedAt, c.Date, c.Now, c.Week, c.DayOfWeek, c.WeeksTotal, got, c.Want)
		}
	}
}

func TestWeekRange(t *testing.T) {
	cases := map[string][2]string{
		"2026-09-24": {"2026-09-21", "2026-09-27"}, // Thursday
		"2026-09-21": {"2026-09-21", "2026-09-27"}, // Monday
		"2026-09-27": {"2026-09-21", "2026-09-27"}, // Sunday
	}
	for day, want := range cases {
		d, _ := time.Parse(YMDLayout, day)
		if mon, sun := WeekRange(d); [2]string{mon, sun} != want {
			t.Errorf("WeekRange(%s) = %s..%s, want %v", day, mon, sun, want)
		}
	}
}
