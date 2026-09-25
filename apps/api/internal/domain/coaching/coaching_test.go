package coaching

import "testing"

func TestWeekStrip(t *testing.T) {
	// Week of Mon 2026-09-21; today is Thu 09-24; scheduled Mon, Wed, Thu, Sat.
	strip := WeekStrip("2026-09-21", "2026-09-24", []int{1, 3, 4, 6}, []string{"2026-09-21", "2026-09-22", "2026-09-30"})
	want := []DayState{Done, Done, Missed, PlannedToday, Rest, Planned, Rest}
	for i, day := range strip {
		if day.State != want[i] {
			t.Errorf("day %d (%s) = %s, want %s", i, day.Date, day.State, want[i])
		}
	}
	if strip[0].Weekday != 1 || strip[6].Weekday != 0 || strip[6].Date != "2026-09-27" {
		t.Errorf("strip bounds = %+v … %+v", strip[0], strip[6])
	}
	if len(WeekStrip("bad", "2026-09-24", nil, nil)) != 0 {
		t.Error("bad week start")
	}
}

func TestInviteCode(t *testing.T) {
	if got := InviteCode(3, "ab2cd9"); got != "COACH-3-AB2CD9" {
		t.Errorf("InviteCode = %q", got)
	}
	if got := NormalizeCode("  coach-3-ab2cd9 "); got != "COACH-3-AB2CD9" {
		t.Errorf("NormalizeCode = %q", got)
	}
}
