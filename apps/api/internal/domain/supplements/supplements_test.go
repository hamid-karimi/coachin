package supplements

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

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

func TestNormalize(t *testing.T) {
	cases := []struct {
		kind string
		days []int
		want Schedule
	}{
		{"daily", []int{1}, Schedule{ScheduleType: Daily}},
		{"weekly", nil, Schedule{ScheduleType: Daily}},
		{"", nil, Schedule{ScheduleType: Daily}},
		{"training_days", []int{2}, Schedule{ScheduleType: TrainingDays}},
		{"custom", []int{5, 1, 5, 9, -1, 0}, Schedule{ScheduleType: Custom, DaysOfWeek: []int{0, 1, 5}}},
		{"custom", nil, Schedule{ScheduleType: Custom, DaysOfWeek: []int{}}},
	}
	for _, c := range cases {
		if got := Normalize(c.kind, c.days); !reflect.DeepEqual(got, c.want) {
			t.Errorf("Normalize(%q, %v) = %+v, want %+v", c.kind, c.days, got, c.want)
		}
	}
}

func TestWindow(t *testing.T) {
	end := time.Date(2026, 9, 25, 12, 0, 0, 0, time.Local) // Friday
	str := func(s string) *string { return &s }
	// A plan started Mon 09-14 (week 2 = 09-21..27) training Wednesdays in week 2;
	// a Friday routine that only starts 09-25.
	window := Window(end, 7, []PlanDay{{PlanCreatedAt: time.Date(2026, 9, 14, 8, 0, 0, 0, time.Local), WeeksTotal: 8, Week: 2, Weekday: 3}},
		[]RoutineDay{{Weekday: 5, StartsOn: str("2026-09-25")}})
	if len(window) != 7 || window[0].YMD != "2026-09-19" || window[6].YMD != "2026-09-25" {
		t.Fatalf("window = %+v", window)
	}
	training := []string{}
	for _, d := range window {
		if d.IsTrainingDay {
			training = append(training, d.YMD)
		}
	}
	if strings.Join(training, ",") != "2026-09-23,2026-09-25" {
		t.Errorf("training days = %v", training)
	}
	for _, d := range Window(end, 3, nil, nil) {
		if !d.IsTrainingDay {
			t.Errorf("no structure: %s should count as training", d.YMD)
		}
	}
}
