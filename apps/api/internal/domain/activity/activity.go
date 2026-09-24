// Package activity holds the watch-file import rules (FORMULAS.md §14):
// imported runs become completed logs, only within a recent window and never
// twice for one date.
package activity

import (
	"regexp"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Import limits.
const (
	WindowDays    = 14
	MaxActivities = 20
	maxDistanceKm = 500
)

// Summary is one activity read from a FIT or GPX file.
type Summary struct {
	Date         string   `json:"date"` // YYYY-MM-DD
	DistanceKm   float64  `json:"distance_km"`
	DurationMin  float64  `json:"duration_min"`
	AvgPaceMinKm *float64 `json:"avg_pace_min_km"`
	AvgHR        *float64 `json:"avg_hr"`
	Source       string   `json:"source"` // fit | gpx
}

var ymdPattern = regexp.MustCompile(`^[0-9]{4}-[0-9]{2}-[0-9]{2}$`)

// Sanitize validates client-sent summaries (decoded JSON): bad entries are
// dropped, numbers rounded, at most MaxActivities kept.
func Sanitize(raw any) []Summary {
	entries, ok := raw.([]any)
	if !ok {
		return []Summary{}
	}
	out := []Summary{}
	for _, entry := range entries[:min(len(entries), MaxActivities)] {
		if _, isObject := entry.(map[string]any); !isObject {
			continue
		}
		date := ""
		if v := jsnum.Field(entry, "date"); v != nil && v != (jsnum.Missing{}) {
			date = jsnum.ToString(v)
		}
		distance := jsnum.ToNumber(jsnum.Field(entry, "distance_km"))
		duration := jsnum.ToNumber(jsnum.Field(entry, "duration_min"))
		if !ymdPattern.MatchString(date) ||
			!jsnum.IsFinite(distance) || distance <= 0 || distance > maxDistanceKm ||
			!jsnum.IsFinite(duration) || duration <= 0 {
			continue
		}
		summary := Summary{
			Date:        date,
			DistanceKm:  jsnum.Round(distance*100) / 100,
			DurationMin: jsnum.Round(duration*10) / 10,
			Source:      "gpx",
		}
		if hr := jsnum.ToNumber(jsnum.Field(entry, "avg_hr")); jsnum.IsFinite(hr) && hr > 0 {
			rounded := jsnum.Round(hr)
			summary.AvgHR = &rounded
		}
		if source, _ := jsnum.Field(entry, "source").(string); source == "fit" {
			summary.Source = "fit"
		}
		out = append(out, summary)
	}
	return out
}

// Split sorts activities into what to import, what already has a log that
// date, and what falls outside the window.
type Split struct {
	Importable  []Summary `json:"importable"`
	Duplicates  []string  `json:"duplicates"`
	OutOfWindow []string  `json:"outOfWindow"`
}

// SplitImportable keeps activities from the last WindowDays days (ending at
// today, YYYY-MM-DD) whose date has no log yet — one per date.
func SplitImportable(activities []Summary, existingLogDates []string, today string) (Split, error) {
	end, err := time.Parse(dates.YMDLayout, today)
	if err != nil {
		return Split{}, err
	}
	windowStart := dates.ToYMD(end.AddDate(0, 0, -(WindowDays - 1)))

	taken := map[string]bool{}
	for _, date := range existingLogDates {
		taken[date] = true
	}
	split := Split{Importable: []Summary{}, Duplicates: []string{}, OutOfWindow: []string{}}
	for _, a := range activities {
		switch {
		case a.Date < windowStart || a.Date > today:
			split.OutOfWindow = append(split.OutOfWindow, a.Date)
		case taken[a.Date]:
			split.Duplicates = append(split.Duplicates, a.Date)
		default:
			taken[a.Date] = true
			split.Importable = append(split.Importable, a)
		}
	}
	return split, nil
}

// Too little to count as a run (legacy parser thresholds).
const (
	minDistanceMeters  = 200
	minDurationSeconds = 60
)

// FromTotals turns a watch file's totals into a summary: distance to 0.01 km,
// duration to 0.1 min, pace from the unrounded values, HR rounded. ok is false
// under 200 m or 60 s. The date is the start's UTC date, today without one.
func FromTotals(start *time.Time, meters, seconds float64, avgHR *float64, source string, now time.Time) (Summary, bool) {
	if !jsnum.IsFinite(meters) || meters < minDistanceMeters || !jsnum.IsFinite(seconds) || seconds < minDurationSeconds {
		return Summary{}, false
	}
	day := now
	if start != nil {
		day = *start
	}
	km, minutes := meters/1000, seconds/60
	pace := jsnum.Round(minutes/km*100) / 100
	summary := Summary{
		Date:         day.UTC().Format(dates.YMDLayout),
		DistanceKm:   jsnum.Round(km*100) / 100,
		DurationMin:  jsnum.Round(minutes*10) / 10,
		AvgPaceMinKm: &pace,
		Source:       source,
	}
	if avgHR != nil && jsnum.IsFinite(*avgHR) {
		hr := jsnum.Round(*avgHR)
		summary.AvgHR = &hr
	}
	return summary, true
}
