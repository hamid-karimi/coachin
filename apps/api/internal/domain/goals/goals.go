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

// Settlement is what a new measurement does to an active goal.
type Settlement int

// Settlements.
const (
	// Keep leaves the goal as it is.
	Keep Settlement = iota
	// SetBaseline records the reading as the goal's start: a goal without a
	// start can't tell "lose to 70" from "gain to 70", so it never pays out
	// on its first reading.
	SetBaseline
	// Achieve settles the goal (+200 XP).
	Achieve
)

// Settle decides what a reading does to an active goal.
func Settle(start *float64, target float64, reading *float64) Settlement {
	if reading == nil || !jsnum.IsFinite(*reading) {
		return Keep
	}
	if start == nil {
		return SetBaseline
	}
	if progress, ok := ProgressOf(start, target, reading); ok && progress.Achieved {
		return Achieve
	}
	return Keep
}

// FromMeasurement reports whether a goal type's current value is a body
// measurement (weight, body fat).
func FromMeasurement(t Type) bool { return TypeMeta[t].Source == "measurement" }
