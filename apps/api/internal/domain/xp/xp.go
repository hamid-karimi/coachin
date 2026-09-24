// Package xp holds the level math and XP awards (FORMULAS.md §1).
package xp

import "github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"

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
