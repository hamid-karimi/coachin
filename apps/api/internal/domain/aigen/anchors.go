package aigen

import (
	"sort"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Anchor is a fixed weekly commitment (a schedules row) the plan must respect.
type Anchor struct {
	DayOfWeek int     `json:"day_of_week"` // 0=Sun … 6=Sat
	Time      *string `json:"time"`        // "HH:MM[:SS]" or nil
	Sport     string  `json:"sport"`
}

var shortDays = []string{"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}

// mondayFirst is each weekday's position in a Monday-first week.
func mondayFirst(day int) int {
	if day < 0 || day > 6 {
		return 7
	}
	return (day + 6) % 7
}

// AnchorsPromptBlock is the constraints paragraph appended to plan prompts,
// or "" when there are no anchors. Prompt-level only: nothing is
// hard-scheduled.
func AnchorsPromptBlock(anchors []Anchor) string {
	if len(anchors) == 0 {
		return ""
	}
	sorted := append([]Anchor(nil), anchors...)
	sort.SliceStable(sorted, func(i, j int) bool { return mondayFirst(sorted[i].DayOfWeek) < mondayFirst(sorted[j].DayOfWeek) })
	slots := make([]string, len(sorted))
	for i, a := range sorted {
		day := "day " + jsnum.FormatNumber(float64(a.DayOfWeek))
		if a.DayOfWeek >= 0 && a.DayOfWeek <= 6 {
			day = shortDays[a.DayOfWeek]
		}
		parts := []string{day}
		if a.Time != nil && *a.Time != "" {
			parts = append(parts, jsnum.Slice(*a.Time, 5))
		}
		if a.Sport != "" {
			parts = append(parts, a.Sport)
		}
		slots[i] = strings.Join(parts, " ")
	}
	return "The athlete has fixed weekly commitments that this plan must respect: [" + strings.Join(slots, ", ") + "]. " +
		"Do not schedule plan sessions that conflict with those slots. " +
		"Treat them as training load: avoid scheduling HARD sessions (long runs, intervals, heavy strength) " +
		"on the same day as an intense fixed commitment; prefer easy/recovery or rest on those days " +
		"and place key sessions on free days."
}
