// Package xp holds the level math (FORMULAS.md §1).
package xp

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
