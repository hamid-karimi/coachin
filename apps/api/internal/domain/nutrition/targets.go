// Package nutrition is the nutrition math: daily targets (FORMULAS.md §10),
// unit conversion and trends (§8), meal adherence and grocery lists (§13).
package nutrition

import (
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Goal is what the meal plan aims for.
type Goal string

// Nutrition goals.
const (
	Lose     Goal = "lose"
	Maintain Goal = "maintain"
	Gain     Goal = "gain"
	Recomp   Goal = "recomp"
)

// TargetInputs are the body metrics and training load targets derive from.
type TargetInputs struct {
	Sex      *string  `json:"sex"`
	Age      *float64 `json:"age"`
	HeightCm *float64 `json:"heightCm"`
	WeightKg *float64 `json:"weightKg"`
	// TrainingDaysPerWeek is distinct training days in a typical week (0–7).
	TrainingDaysPerWeek float64 `json:"trainingDaysPerWeek"`
	Goal                Goal    `json:"goal"`
}

// Targets are daily calorie and macro targets.
type Targets struct {
	Kcal     float64 `json:"kcal"`
	ProteinG float64 `json:"protein_g"`
	CarbsG   float64 `json:"carbs_g"`
	FatG     float64 `json:"fat_g"`
}

// goalAdjust shifts TDEE by goal.
var goalAdjust = map[Goal]float64{Lose: -0.18, Maintain: 0, Gain: 0.12, Recomp: 0}

// proteinPerKg is protein grams per kg bodyweight by goal.
var proteinPerKg = map[Goal]float64{Lose: 2.2, Recomp: 2.2, Maintain: 1.6, Gain: 1.8}

// sexOffset is the Mifflin–St Jeor constant; unspecified sex uses the
// male/female midpoint.
func sexOffset(sex *string) float64 {
	value := ""
	if sex != nil {
		value = strings.ToLower(*sex)
	}
	switch {
	case strings.HasPrefix(value, "m"):
		return 5
	case strings.HasPrefix(value, "f"):
		return -161
	}
	return -78
}

// activityFactor maps weekly training days (rounded, clamped 0–7) to a TDEE
// multiplier.
func activityFactor(trainingDaysPerWeek float64) float64 {
	days := max(0, min(7, jsnum.Round(trainingDaysPerWeek)))
	switch {
	case days == 0:
		return 1.2
	case days <= 2:
		return 1.375
	case days <= 4:
		return 1.55
	case days <= 6:
		return 1.725
	}
	return 1.9
}

func positive(v *float64) bool { return v != nil && *v > 0 }

// CanComputeTargets reports whether age, height, and weight are all present.
func CanComputeTargets(in TargetInputs) bool {
	return positive(in.Age) && positive(in.HeightCm) && positive(in.WeightKg)
}

// ComputeTargets returns daily kcal + macros, or ok=false without body
// metrics. Calories never drop below BMR × 1.1; fat is 25% of calories,
// protein scales with bodyweight per goal, carbs take the remainder.
func ComputeTargets(in TargetInputs) (Targets, bool) {
	if !CanComputeTargets(in) {
		return Targets{}, false
	}
	weight, height, age := *in.WeightKg, *in.HeightCm, *in.Age

	bmr := 10*weight + 6.25*height - 5*age + sexOffset(in.Sex)
	tdee := bmr * activityFactor(in.TrainingDaysPerWeek)
	adjusted := tdee * (1 + goalAdjust[in.Goal])
	kcal := jsnum.Round(max(adjusted, bmr*1.1)/10) * 10

	protein := jsnum.Round(weight * proteinPerKg[in.Goal])
	fat := jsnum.Round(kcal * 0.25 / 9)
	carbs := jsnum.Round(max(0, kcal-protein*4-fat*9) / 4)
	return Targets{Kcal: kcal, ProteinG: protein, CarbsG: carbs, FatG: fat}, true
}
