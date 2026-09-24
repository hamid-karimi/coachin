// Package supplements is the daily-stack due rules and taken-rate math
// (FORMULAS.md §13). Informational only: never XP, streaks, or hearts.
// Weekdays are 0=Sun … 6=Sat.
package supplements

import (
	"slices"
	"strings"
)

// ScheduleType is how often a supplement is due.
type ScheduleType string

// Schedule types; anything else behaves like Daily.
const (
	Daily        ScheduleType = "daily"
	TrainingDays ScheduleType = "training_days"
	Custom       ScheduleType = "custom"
)

// Schedule is a supplement's due rule.
type Schedule struct {
	ScheduleType ScheduleType `json:"scheduleType"`
	DaysOfWeek   []int        `json:"daysOfWeek"`
}

// Day is the context a due check needs. IsTrainingDay must be true when the
// user has no active plan, so training-day supplements degrade to daily.
type Day struct {
	Weekday       int  `json:"weekday"`
	IsTrainingDay bool `json:"isTrainingDay"`
}

var dueRules = map[ScheduleType]func(Schedule, Day) bool{
	Daily:        func(Schedule, Day) bool { return true },
	TrainingDays: func(_ Schedule, d Day) bool { return d.IsTrainingDay },
	// An empty custom list is due every day, so a misconfigured schedule never
	// strands a supplement off the checklist.
	Custom: func(s Schedule, d Day) bool {
		return len(s.DaysOfWeek) == 0 || slices.Contains(s.DaysOfWeek, d.Weekday)
	},
}

// IsDue reports whether the supplement is due on day.
func IsDue(s Schedule, day Day) bool {
	rule, ok := dueRules[s.ScheduleType]
	if !ok {
		rule = dueRules[Daily]
	}
	return rule(s, day)
}

var weekdayNames = []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}

// Label reads a schedule for people: "Every day", "Training days", or a
// Sun→Sat list like "Sun · Tue · Thu".
func Label(s Schedule) string {
	switch {
	case s.ScheduleType == TrainingDays:
		return "Training days"
	case s.ScheduleType == Custom && len(s.DaysOfWeek) > 0:
		names := []string{}
		for index, name := range weekdayNames {
			if slices.Contains(s.DaysOfWeek, index) {
				names = append(names, name)
			}
		}
		return strings.Join(names, " · ")
	}
	return "Every day"
}

// WindowDay is one local day of a taken-rate window.
type WindowDay struct {
	YMD string `json:"ymd"`
	Day
}

// TakenRate counts a supplement's due days and how many were logged.
type TakenRate struct {
	TakenDueDays int `json:"takenDueDays"`
	TotalDueDays int `json:"totalDueDays"`
}

// TakenRateOver counts due days on/after createdYMD in window, and how many of
// them appear in taken. YYYY-MM-DD strings compare correctly as text.
func TakenRateOver(s Schedule, createdYMD string, window []WindowDay, taken map[string]bool) TakenRate {
	var rate TakenRate
	for _, day := range window {
		if day.YMD < createdYMD || !IsDue(s, day.Day) {
			continue
		}
		rate.TotalDueDays++
		if taken[day.YMD] {
			rate.TakenDueDays++
		}
	}
	return rate
}

// Normalize reads a submitted schedule: an unknown type becomes Daily; days
// are kept only for Custom (0–6, deduplicated, sorted; possibly empty) and
// are nil otherwise.
func Normalize(scheduleType string, days []int) Schedule {
	s := Schedule{ScheduleType: ScheduleType(scheduleType)}
	if _, known := dueRules[s.ScheduleType]; !known {
		s.ScheduleType = Daily
	}
	if s.ScheduleType != Custom {
		return s
	}
	s.DaysOfWeek = []int{}
	for _, day := range days {
		if day >= 0 && day <= 6 && !slices.Contains(s.DaysOfWeek, day) {
			s.DaysOfWeek = append(s.DaysOfWeek, day)
		}
	}
	slices.Sort(s.DaysOfWeek)
	return s
}
