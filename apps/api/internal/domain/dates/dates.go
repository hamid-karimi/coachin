// Package dates is the plan-week and calendar math (FORMULAS.md §9).
//
// "Local" means the location of the time values passed in; the API runs with
// TZ=UTC, matching the legacy app on Vercel. Every function takes "now"
// explicitly instead of reading the clock, so results are reproducible.
package dates

import (
	"math"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

const (
	day  = 24 * time.Hour
	week = 7 * day
	// year is the average Gregorian year, as the legacy age math used.
	year = time.Duration(365.25 * float64(day))
)

// YMDLayout is the YYYY-MM-DD format dates are stored and exchanged in.
const YMDLayout = "2006-01-02"

// ToYMD formats t's calendar date in its own location.
func ToYMD(t time.Time) string { return t.Format(YMDLayout) }

// MondayOf is midnight on the Monday of t's week (weeks start on Monday).
func MondayOf(t time.Time) time.Time {
	y, m, d := t.Date()
	midnight := time.Date(y, m, d, 0, 0, 0, 0, t.Location())
	offset := (int(t.Weekday()) + 6) % 7 // Mon=0 … Sun=6
	return midnight.AddDate(0, 0, -offset)
}

// WeekRange is the Monday and Sunday (YYYY-MM-DD) of t's week.
func WeekRange(t time.Time) (monday, sunday string) {
	start := MondayOf(t)
	return ToYMD(start), ToYMD(start.AddDate(0, 0, 6))
}

// PlanWeekForDate is which 1-based plan week date falls in; week 1 is the
// Monday-anchored week containing createdAt. May be out of the plan's range.
func PlanWeekForDate(createdAt, date time.Time) int {
	diff := MondayOf(date).Sub(MondayOf(createdAt.In(date.Location())))
	return int(jsnum.Round(float64(diff)/float64(week))) + 1
}

// PlanWeekOf is the current plan week, clamped to 1..weeksTotal.
func PlanWeekOf(createdAt time.Time, weeksTotal int, now time.Time) int {
	return min(max(PlanWeekForDate(createdAt, now), 1), weeksTotal)
}

// LastElapsedPlanWeek is the last fully elapsed plan week (0 during week 1),
// clamped to the plan length — the week a check-in reviews.
func LastElapsedPlanWeek(createdAt time.Time, weeksTotal int, now time.Time) int {
	return min(max(PlanWeekForDate(createdAt, now)-1, 0), weeksTotal)
}

// PlanItemDate is the calendar date of a plan item. dayOfWeek is 0=Sun…6=Sat;
// weeks render Monday-first.
func PlanItemDate(createdAt time.Time, weekNumber, dayOfWeek int) time.Time {
	mondayPosition := (dayOfWeek + 6) % 7
	return MondayOf(createdAt).AddDate(0, 0, (weekNumber-1)*7+mondayPosition)
}

// DaysUntil counts whole days from now until local midnight of ymd, never
// negative. ok is false when ymd isn't a YYYY-MM-DD date.
func DaysUntil(ymd string, now time.Time) (days int, ok bool) {
	target, err := time.ParseInLocation(YMDLayout, ymd, now.Location())
	if err != nil {
		return 0, false
	}
	return int(max(0, math.Ceil(float64(target.Sub(now))/float64(day)))), true
}

// WeeksSince is whole weeks elapsed since t (0 during the first week).
func WeeksSince(t, now time.Time) int {
	return int(math.Floor(float64(now.Sub(t)) / float64(week)))
}

// YearsSince is whole years since a YYYY-MM-DD date (age from a birth date).
// A date-only value means UTC midnight, as JavaScript parsed it. ok is false
// for an empty or unreadable date.
func YearsSince(ymd string, now time.Time) (years int, ok bool) {
	if ymd == "" {
		return 0, false
	}
	t, err := time.Parse(YMDLayout, ymd)
	if err != nil {
		if t, err = time.Parse(time.RFC3339Nano, ymd); err != nil {
			return 0, false
		}
	}
	return int(math.Floor(float64(now.Sub(t)) / float64(year))), true
}
