// Package xp holds the level math and XP awards (FORMULAS.md §1).
package xp

import (
	"strconv"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// PointsPerLevel is flat: every level costs the same XP.
const PointsPerLevel = 1000

// Progress is how far a user is into their current level.
type Progress struct {
	CurrentXP   int64 `json:"currentXp"`
	NextLevelXP int64 `json:"nextLevelXp"`
}

// LevelProgress is the XP bar's fill: total mod 1000 of 1000. Negative totals
// count as 0.
func LevelProgress(total int64) Progress {
	total = max(total, 0)
	return Progress{CurrentXP: total % PointsPerLevel, NextLevelXP: PointsPerLevel}
}

// Level is floor(total / 1000) + 1, so level 1 spans 0–999 XP.
func Level(total int64) int64 {
	level := total / PointsPerLevel
	if total < 0 && total%PointsPerLevel != 0 {
		level-- // floor division, as the formula states
	}
	return level + 1
}

// BaseWorkoutXP is one "60-minute session"; routine workouts scale it by the
// sport's multiplier.
const BaseWorkoutXP = 60

// SessionLogXP is the one-time bonus for logging how a plan session went.
const SessionLogXP = 10

// Multiplier is a sport's effective XP multiplier: a missing or zero
// sport_types.xp_multiplier counts as 1.
func Multiplier(raw *float64) float64 {
	if raw == nil || *raw == 0 {
		return 1
	}
	return *raw
}

// EstimatedWeeklyXP is the "My week" estimate: each weekly fixed session
// counts 60 × its sport's multiplier, and the sum is rounded once (as the
// legacy page did), not each session.
func EstimatedWeeklyXP(sessionMultipliers []float64) int64 {
	var total float64
	for _, m := range sessionMultipliers {
		total += BaseWorkoutXP * m
	}
	return int64(jsnum.Round(total))
}

// ReasonLabel is the ledger reason as the profile's "Recent XP" list shows it
// (legacy formatReason): "workout_log:<sport id>[:<date>]" → "<Sport> workout", anything
// about streaks → "Streak bonus", otherwise the reason without its ":<id>"
// suffix and with spaces for underscores (legacy kept the id: "goal
// achieved:3f2a…").
func ReasonLabel(reason *string, sportNames map[int64]string) string {
	if reason == nil || *reason == "" {
		return "XP earned"
	}
	r := *reason
	if rest, ok := strings.CutPrefix(r, "workout_log:"); ok {
		// Legacy wrote workout_log:<sport id>; the API adds :<date>.
		id, _, _ := strings.Cut(rest, ":")
		if n, err := strconv.ParseInt(id, 10, 64); err == nil && isDigits(id) {
			if name, ok := sportNames[n]; ok {
				return name + " workout"
			}
			return "Workout logged"
		}
	}
	if strings.Contains(r, "streak") {
		return "Streak bonus"
	}
	kind, _, _ := strings.Cut(r, ":")
	return strings.ReplaceAll(kind, "_", " ")
}

func isDigits(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return s != ""
}
