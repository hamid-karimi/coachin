// Package running is the pure running math (FORMULAS.md §4–5): Riegel
// predictions, race distances, and time parsing/formatting.
package running

import (
	"fmt"
	"math"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// RiegelExponent is the standard endurance fatigue exponent.
const RiegelExponent = 1.06

// RiegelSeconds predicts a time over targetKm from a known effort:
// t2 = t1 × (d2 / d1)^1.06, rounded to whole seconds. Non-positive inputs → 0.
func RiegelSeconds(knownKm, knownSeconds, targetKm float64) float64 {
	if knownKm <= 0 || knownSeconds <= 0 || targetKm <= 0 {
		return 0
	}
	return jsnum.Round(knownSeconds * math.Pow(targetKm/knownKm, RiegelExponent))
}

// ParseTimeToSeconds reads "m:ss" or "h:mm:ss" ("4:05" → 245,
// "3:59:30" → 14370). ok is false when it can't be read.
func ParseTimeToSeconds(value string) (seconds float64, ok bool) {
	raw := strings.Split(strings.TrimSpace(value), ":")
	parts := make([]float64, len(raw))
	for i, part := range raw {
		n, valid := jsnum.Number(part)
		if !valid || n < 0 {
			return 0, false
		}
		parts[i] = n
	}
	switch len(parts) {
	case 3:
		return parts[0]*3600 + parts[1]*60 + parts[2], true
	case 2:
		return parts[0]*60 + parts[1], true
	}
	return 0, false
}

// FormatSeconds renders whole seconds as "h:mm:ss", or "m:ss" under an hour.
func FormatSeconds(totalSeconds float64) string {
	seconds := int64(max(0, jsnum.Round(totalSeconds)))
	hours, minutes, rest := seconds/3600, (seconds%3600)/60, seconds%60
	if hours > 0 {
		return fmt.Sprintf("%d:%02d:%02d", hours, minutes, rest)
	}
	return fmt.Sprintf("%d:%02d", minutes, rest)
}

// Base-building ("just start running") program lengths, in weeks.
const (
	BaseWeeksDefault = 8
	BaseWeeksMin     = 4
	BaseWeeksMax     = 24
)

// BaseWeekOptions are the lengths offered in the wizard.
var BaseWeekOptions = []int{6, 8, 12}

// ClampBaseWeeks rounds and clamps a requested length to 4..24 weeks;
// missing input gets the default.
func ClampBaseWeeks(value *float64) int {
	if value == nil || math.IsNaN(*value) || math.IsInf(*value, 0) {
		return BaseWeeksDefault
	}
	return int(min(BaseWeeksMax, max(BaseWeeksMin, jsnum.Round(*value))))
}

// PBDistancesKm maps each personal-best key to its distance.
var PBDistancesKm = map[string]float64{
	"pb_5k":   5,
	"pb_10k":  10,
	"pb_half": 21.0975,
	"pb_full": 42.195,
}

// RaceTargetKm are the preset race targets; "ultra" and "other" take a
// user-typed distance instead.
var RaceTargetKm = map[string]float64{
	"5k":   5,
	"10k":  10,
	"half": 21.0975,
	"full": 42.195,
}

// RaceDistanceKm resolves a target's distance; ultra/other need a positive
// customKm. ok is false when there is no usable distance.
func RaceDistanceKm(target string, customKm *float64) (km float64, ok bool) {
	if preset, found := RaceTargetKm[target]; found {
		return preset, true
	}
	if customKm != nil && *customKm > 0 {
		return *customKm, true
	}
	return 0, false
}

// PBs are a runner's personal bests as typed ("25:00", "3:59:30").
type PBs struct {
	PB5k   string `json:"pb_5k"`
	PB10k  string `json:"pb_10k"`
	PBHalf string `json:"pb_half"`
	PBFull string `json:"pb_full"`
}

// SuggestGoalForDistance predicts a goal time for targetKm from the longest
// usable personal best (longer efforts predict better). ok is false when no
// PB can be read.
func SuggestGoalForDistance(pbs PBs, targetKm float64) (goal string, ok bool) {
	if targetKm <= 0 {
		return "", false
	}
	longestFirst := []struct{ key, time string }{
		{"pb_full", pbs.PBFull}, {"pb_half", pbs.PBHalf}, {"pb_10k", pbs.PB10k}, {"pb_5k", pbs.PB5k},
	}
	for _, pb := range longestFirst {
		if pb.time == "" {
			continue
		}
		seconds, valid := ParseTimeToSeconds(pb.time)
		if !valid || seconds == 0 {
			continue
		}
		knownKm := PBDistancesKm[pb.key]
		if math.Abs(knownKm-targetKm) < 0.01 {
			return FormatSeconds(seconds), true
		}
		return FormatSeconds(RiegelSeconds(knownKm, seconds, targetKm)), true
	}
	return "", false
}
