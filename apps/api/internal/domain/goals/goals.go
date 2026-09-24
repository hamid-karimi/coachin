// Package goals is goal metadata and progress math (FORMULAS.md §6).
package goals

import "github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"

// Type is what a goal measures.
type Type string

// The goal types a user can set.
const (
	Weight         Type = "weight"
	BodyFatPct     Type = "body_fat_pct"
	CalorieIntake  Type = "calorie_intake"
	CaloriesBurned Type = "calories_burned"
	WeeklyRunKm    Type = "weekly_run_km"
	MonthlyRunKm   Type = "monthly_run_km"
)

// Meta describes a goal type for display and says where its current value
// comes from ("measurement", "nutrition", or "activity").
type Meta struct {
	Label  string `json:"label"`
	Unit   string `json:"unit"`
	Source string `json:"source"`
}

// TypeMeta is the metadata for every goal type.
var TypeMeta = map[Type]Meta{
	Weight:         {Label: "Weight", Unit: "kg", Source: "measurement"},
	BodyFatPct:     {Label: "Body fat", Unit: "%", Source: "measurement"},
	CalorieIntake:  {Label: "Daily calorie intake", Unit: "kcal", Source: "nutrition"},
	CaloriesBurned: {Label: "Daily calories burned", Unit: "kcal", Source: "nutrition"},
	WeeklyRunKm:    {Label: "Weekly running", Unit: "km", Source: "activity"},
	MonthlyRunKm:   {Label: "Monthly running", Unit: "km", Source: "activity"},
}

// Direction is whether a goal counts up (run more) or down (weigh less).
type Direction string

// Goal directions.
const (
	Up   Direction = "up"
	Down Direction = "down"
)

// Progress is movement from start toward target.
type Progress struct {
	// Pct is 0–100.
	Pct       float64   `json:"pct"`
	Direction Direction `json:"direction"`
	Achieved  bool      `json:"achieved"`
}

// ProgressOf measures current against start → target. A goal whose target is
// below its start counts down. Without a usable start value, progress is a
// plain ratio toward the target. ok is false when there is no current value.
func ProgressOf(start *float64, target float64, current *float64) (progress Progress, ok bool) {
	if current == nil || !jsnum.IsFinite(*current) {
		return Progress{}, false
	}
	now := *current

	hasStart := start != nil && jsnum.IsFinite(*start) && *start != target
	direction := Up
	if hasStart && target < *start {
		direction = Down
	}
	achieved := now >= target
	if direction == Down {
		achieved = now <= target
	}

	var pct float64
	switch {
	case !hasStart && direction == Down && achieved:
		pct = 100
	case !hasStart && direction == Down:
		pct = jsnum.Round(target / now * 100)
	case !hasStart:
		pct = jsnum.Round(now / target * 100)
	case direction == Down:
		pct = jsnum.Round((*start - now) / (*start - target) * 100)
	default:
		pct = jsnum.Round((now - *start) / (target - *start) * 100)
	}
	return Progress{Pct: max(0, min(100, pct)), Direction: direction, Achieved: achieved}, true
}
