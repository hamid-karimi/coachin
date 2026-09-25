// Package coaching is the coach hub's pure rules: the trainee's week strip
// and invite-code shape.
package coaching

import (
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
)

// DayState is one dot of a trainee's week.
type DayState string

// Day states, in legacy precedence order.
const (
	Done         DayState = "done"
	Missed       DayState = "missed"
	PlannedToday DayState = "planned_today"
	Planned      DayState = "planned"
	Rest         DayState = "rest"
)

// Day is one date of the strip.
type Day struct {
	Date    string
	Weekday int // 0=Sun … 6=Sat
	State   DayState
}

// WeekStrip is the Monday-first 7-day strip (legacy AdherenceWeekStrip): a
// completed log is done; otherwise a scheduled weekday is missed (past),
// planned today, or planned (future); anything else is rest.
func WeekStrip(weekStart, today string, scheduledDays []int, loggedDates []string) []Day {
	monday, err := time.Parse(dates.YMDLayout, weekStart)
	if err != nil {
		return []Day{}
	}
	strip := make([]Day, 7)
	for i := range strip {
		date := monday.AddDate(0, 0, i)
		ymd := dates.ToYMD(date)
		weekday := int(date.Weekday())
		strip[i] = Day{Date: ymd, Weekday: weekday, State: stateOf(ymd, today, slices.Contains(scheduledDays, weekday), slices.Contains(loggedDates, ymd))}
	}
	return strip
}

func stateOf(date, today string, scheduled, logged bool) DayState {
	switch {
	case logged:
		return Done
	case !scheduled:
		return Rest
	case date < today:
		return Missed
	case date == today:
		return PlannedToday
	default:
		return Planned
	}
}

// InviteAlphabet has no look-alikes (0/O, 1/I/L).
const InviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// InviteCode is "COACH-<sport id>-<chunk>" (legacy shape), upper-cased.
func InviteCode(sportTypeID int64, chunk string) string {
	return strings.ToUpper("COACH-" + strconv.FormatInt(sportTypeID, 10) + "-" + chunk)
}

// NormalizeCode is how a typed code is compared.
func NormalizeCode(raw string) string {
	return strings.ToUpper(strings.TrimSpace(raw))
}
