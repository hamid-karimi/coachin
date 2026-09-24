// Package progress shapes logged history into chart series and decides the
// progress-photo nudge (FORMULAS.md §15). Stats are additive evidence of what
// was done, never judgments.
package progress

import (
	"slices"
	"strings"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/workout"
)

// DefaultWeeks is how many weekly buckets a chart shows.
const DefaultWeeks = 8

// ChartPoint is one labelled value ("Jul 6").
type ChartPoint struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

// SessionLog is the part of a session log the charts read. CreatedAt is in
// the caller's local zone.
type SessionLog struct {
	CreatedAt time.Time      `json:"created_at"`
	Sport     string         `json:"sport"`
	Actual    map[string]any `json:"actual"`
}

func shortLabel(t time.Time) string { return t.Format("Jan 2") }

// weekBuckets are the Mondays of the last `weeks` weeks, oldest first.
func weekBuckets(today time.Time, weeks int) []time.Time {
	current := dates.MondayOf(today)
	buckets := make([]time.Time, weeks)
	for i := range buckets {
		buckets[i] = current.AddDate(0, 0, -(weeks-1-i)*7)
	}
	return buckets
}

func weekKey(t time.Time) string { return dates.ToYMD(dates.MondayOf(t)) }

// weekly sums per-log values into Monday-anchored buckets.
func weekly(logs []SessionLog, today time.Time, weeks int, value func(SessionLog) (float64, bool), round func(float64) float64) []ChartPoint {
	totals := map[string]float64{}
	for _, log := range logs {
		if v, ok := value(log); ok {
			totals[weekKey(log.CreatedAt.In(today.Location()))] += v
		}
	}
	points := []ChartPoint{}
	for _, start := range weekBuckets(today, weeks) {
		points = append(points, ChartPoint{Label: shortLabel(start), Value: round(totals[dates.ToYMD(start)])})
	}
	return points
}

func exercisesOf(log SessionLog) []workout.Exercise {
	var raw any
	if log.Actual != nil {
		raw = log.Actual["exercises"]
	}
	return workout.NormalizeLoggedExercises(raw)
}

// WeeklyVolume is strength volume (kg) per week.
func WeeklyVolume(logs []SessionLog, today time.Time, weeks int) []ChartPoint {
	return weekly(logs, today, weeks, func(log SessionLog) (float64, bool) {
		if log.Sport != "strength" {
			return 0, false
		}
		volume := workout.TotalVolumeKg(exercisesOf(log))
		return volume, volume > 0
	}, jsnum.Round)
}

// WeeklyKm is running distance per week, one decimal.
func WeeklyKm(logs []SessionLog, today time.Time, weeks int) []ChartPoint {
	return weekly(logs, today, weeks, func(log SessionLog) (float64, bool) {
		if log.Sport != "run" {
			return 0, false
		}
		var raw any = jsnum.Missing{}
		if log.Actual != nil {
			raw = jsnum.Field(log.Actual, "distance_km")
		}
		km := jsnum.ToNumber(raw)
		return km, jsnum.IsFinite(km) && km > 0
	}, func(x float64) float64 { return jsnum.Round(x*10) / 10 })
}

// ExerciseTrend is one exercise's top weight per session day.
type ExerciseTrend struct {
	Name   string       `json:"name"`
	Points []ChartPoint `json:"points"`
}

type exerciseDays struct {
	display  string
	topByDay map[string]float64
	days     []string // first-seen order
}

// ExerciseTopSets charts the heaviest set per session day for the exercises
// logged on the most days (at least minSessions days), up to maxExercises.
func ExerciseTopSets(logs []SessionLog, minSessions, maxExercises int, loc *time.Location) []ExerciseTrend {
	sorted := slices.Clone(logs)
	slices.SortStableFunc(sorted, func(a, b SessionLog) int { return a.CreatedAt.Compare(b.CreatedAt) })

	byName := map[string]*exerciseDays{}
	var order []*exerciseDays
	for _, log := range sorted {
		if log.Sport != "strength" {
			continue
		}
		for _, exercise := range exercisesOf(log) {
			var top float64
			for _, set := range exercise.Sets {
				top = max(top, set.WeightKg)
			}
			if top <= 0 {
				continue
			}
			key := strings.ToLower(exercise.Name)
			entry, ok := byName[key]
			if !ok {
				entry = &exerciseDays{display: exercise.Name, topByDay: map[string]float64{}}
				byName[key] = entry
				order = append(order, entry)
			}
			day := dates.ToYMD(log.CreatedAt.In(loc))
			if _, seen := entry.topByDay[day]; !seen {
				entry.days = append(entry.days, day)
			}
			entry.topByDay[day] = max(entry.topByDay[day], top)
		}
	}

	qualifying := slices.DeleteFunc(order, func(e *exerciseDays) bool { return len(e.days) < minSessions })
	slices.SortStableFunc(qualifying, func(a, b *exerciseDays) int { return len(b.days) - len(a.days) })

	trends := []ExerciseTrend{}
	for _, entry := range qualifying[:min(len(qualifying), maxExercises)] {
		days := slices.Sorted(slices.Values(entry.days))
		points := make([]ChartPoint, len(days))
		for i, day := range days {
			midnight, _ := time.ParseInLocation(dates.YMDLayout, day, loc)
			points[i] = ChartPoint{Label: shortLabel(midnight), Value: entry.topByDay[day]}
		}
		trends = append(trends, ExerciseTrend{Name: entry.display, Points: points})
	}
	return trends
}

// Measurement is one body measurement; MeasuredAt is YYYY-MM-DD or a
// timestamp, WeightKg a decoded JSON value (number, numeric string, or null).
type Measurement struct {
	MeasuredAt string `json:"measured_at"`
	WeightKg   any    `json:"weight_kg"`
}

// WeightSeries charts positive weights oldest first, one decimal.
func WeightSeries(measurements []Measurement, loc *time.Location) []ChartPoint {
	valid := slices.DeleteFunc(slices.Clone(measurements), func(m Measurement) bool {
		w := jsnum.ToNumber(m.WeightKg)
		return m.WeightKg == nil || !jsnum.IsFinite(w) || w <= 0
	})
	slices.SortStableFunc(valid, func(a, b Measurement) int { return strings.Compare(a.MeasuredAt, b.MeasuredAt) })

	points := make([]ChartPoint, len(valid))
	for i, m := range valid {
		points[i] = ChartPoint{
			Label: shortLabel(measurementDate(m.MeasuredAt, loc)),
			Value: jsnum.Round(jsnum.ToNumber(m.WeightKg)*10) / 10,
		}
	}
	return points
}

// measurementDate reads a timestamp as an instant, a bare date as local
// midnight.
func measurementDate(value string, loc *time.Location) time.Time {
	if strings.Contains(value, "T") {
		if t, err := time.Parse(time.RFC3339Nano, value); err == nil {
			return t.In(loc)
		}
	}
	t, _ := time.ParseInLocation(dates.YMDLayout, value, loc)
	return t
}

// PhotoNudgeDays is how long after the last progress photo the nudge returns.
const PhotoNudgeDays = 28

// IsPhotoDue nudges an active user (streak or logs this week) whose last
// progress photo is missing or more than PhotoNudgeDays old.
func IsPhotoDue(currentStreak, weekLogCount int, lastPhotoAt *time.Time, today time.Time) bool {
	if currentStreak <= 0 && weekLogCount <= 0 {
		return false
	}
	return lastPhotoAt == nil || today.Sub(*lastPhotoAt) > PhotoNudgeDays*24*time.Hour
}
