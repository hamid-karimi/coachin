package streak

import (
	"testing"
	"time"
)

func day(ymd string) time.Time {
	t, _ := time.Parse("2006-01-02", ymd)
	return t
}

func TestRequired(t *testing.T) {
	// A plan that started Wed 2026-09-02 (week 1 = Mon Aug 31); week 2 has a Tuesday run.
	plan := Plan{CreatedAt: day("2026-09-02").Add(9 * time.Hour), WeeksTotal: 4, Slots: map[Slot]bool{{Week: 2, DayOfWeek: 2}: true}}
	h := History{
		Schedules: []Schedule{
			{DayOfWeek: 1}, // every Monday
			{DayOfWeek: 5, StartsOn: "2026-09-10", EndsOn: "2026-09-20"}, // Fridays, a window
		},
		Plans: []Plan{plan},
	}
	cases := map[string]bool{
		"2026-09-07": true,  // Monday routine
		"2026-09-04": false, // Friday before the window
		"2026-09-11": true,  // Friday in the window
		"2026-09-25": false, // Friday after it
		"2026-09-08": true,  // week 2 Tuesday plan item
		"2026-09-01": false, // week 1 Tuesday: no item
		"2026-09-29": false, // week 5 Tuesday: past the plan
		"2026-09-09": false, // Wednesday: nothing
	}
	for ymd, want := range cases {
		if got := h.Required(day(ymd)); got != want {
			t.Errorf("%s: got %v, want %v", ymd, got, want)
		}
	}
}

func TestWindow(t *testing.T) {
	today := day("2026-09-25")
	if from, to, ok := Window(nil, today); !ok || from != day("2026-09-24") || to != from {
		t.Errorf("first run: %v..%v %v", from, to, ok)
	}
	settled := day("2026-09-20")
	if from, to, ok := Window(&settled, today); !ok || from != day("2026-09-21") || to != day("2026-09-24") {
		t.Errorf("catch-up: %v..%v %v", from, to, ok)
	}
	settled = day("2026-09-24")
	if _, _, ok := Window(&settled, today); ok {
		t.Error("settled through yesterday: nothing to do")
	}
}

func TestSettleRange(t *testing.T) {
	h := History{
		Trained:   map[string]bool{"2026-09-21": true, "2026-09-22": true},
		Schedules: []Schedule{{DayOfWeek: 3}, {DayOfWeek: 4}}, // Wed, Thu required
	}
	// Mon, Tue trained; Wed, Thu missed (2 hearts spent); Fri rest.
	got := SettleRange(State{Streak: 5, Best: 6, Hearts: 3}, day("2026-09-21"), day("2026-09-25"), h)
	if want := (State{Streak: 7, Best: 7, Hearts: 1}); got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
}
