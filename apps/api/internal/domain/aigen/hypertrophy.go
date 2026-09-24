package aigen

import (
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// HypertrophyIntake is a muscle-building plan's intake (stored with
// plan_kind "hypertrophy" merged in).
type HypertrophyIntake struct {
	Goal            string   `json:"goal"` // muscle_gain | recomp
	ExperienceLevel *string  `json:"experience_level"`
	Equipment       string   `json:"equipment"` // gym | home | bodyweight
	DaysPerWeek     int      `json:"days_per_week"`
	WeeksTotal      int      `json:"weeks_total"`
	Injuries        *string  `json:"injuries"`
	CalorieTarget   *float64 `json:"calorie_target"`
	BodyAnalysis    *string  `json:"body_analysis"`
	Age             *int     `json:"age"`
	Sex             *string  `json:"sex"`
	HeightCm        *float64 `json:"height_cm"`
	WeightKg        *float64 `json:"weight_kg"`
	TrainingHistory *string  `json:"training_history"`
	Anchors         []Anchor `json:"anchors"`
}

var equipmentRules = map[string]string{
	"gym":        "Full gym available: barbells, dumbbells, machines, cables.",
	"home":       "Home setup only: dumbbells and resistance bands — no barbell or machines.",
	"bodyweight": "No equipment: bodyweight progressions only (push-up/squat/row variations).",
}

var hypertrophySchema = planSchema(itemSchema(
	[]string{"strength", "mobility", "stretch", "recovery", "meal_note"},
	[]Property{
		{"duration_min", nullable(Number)},
		{"notes", nullable(String)},
		{"video_query", nullable(String)},
	},
))

// HypertrophyRequest builds the muscle-building plan generation request.
func HypertrophyRequest(in HypertrophyIntake) Request {
	athlete := athleteLine(in.Age, in.Sex, in.HeightCm, in.WeightKg)
	if athlete == "" {
		athlete = "unknown"
	}
	kind := "muscle building (hypertrophy)"
	if in.Goal == "recomp" {
		kind = "body recomposition"
	}
	experience := "unknown"
	if in.ExperienceLevel != nil {
		experience = *in.ExperienceLevel
	}
	bodyAnalysis := ""
	if in.BodyAnalysis != nil && *in.BodyAnalysis != "" {
		bodyAnalysis = "Body-photo analysis (consented): " + *in.BodyAnalysis
	}
	equipment, ok := equipmentRules[in.Equipment]
	if !ok {
		equipment = equipmentRules["bodyweight"]
	}
	calories := ""
	if in.CalorieTarget != nil && *in.CalorieTarget != 0 {
		calories = "The athlete targets " + num(*in.CalorieTarget) + " kcal/day — align protein guidance with it."
	}
	protein := "about 1.6-2g protein per kg bodyweight"
	if in.WeightKg != nil && *in.WeightKg != 0 {
		protein = "target ~" + num(jsnum.Round(*in.WeightKg*1.8)) + "g protein/day for " + num(*in.WeightKg) + "kg bodyweight"
	}
	newAthlete := ""
	if in.ExperienceLevel != nil && *in.ExperienceLevel == "new" {
		newAthlete = "- The athlete is new to training: master form first, start light, higher-rep ranges, simple movements."
	}
	weeks := num(float64(in.WeeksTotal))

	lines := []string{
		"Create a " + weeks + "-week " + kind + " training plan.",
		"Athlete: " + athlete + ". Experience: " + experience + ". Training history: " + orUnknown(in.TrainingHistory) + ".",
		bodyAnalysis,
		"Injuries/limitations: " + orText(in.Injuries, "none reported") + ".",
		equipment,
		calories,
		AnchorsPromptBlock(in.Anchors),
		"Rules:",
		"- Exactly " + num(float64(in.DaysPerWeek)) + " strength days per week (day_of_week: 0=Sunday..6=Saturday) using a sensible split for that frequency; remaining days get ONE recovery item.",
		`- Every item: "title" is a SHORT human-readable session name, max 60 characters (e.g. "Upper body — Day A", "Legs & core"). Put the full exercise list in "description" — NEVER in the title.`,
		`- Every strength item (item_type "strength"): short split-name title, the concrete exercise list with sets x reps in "description" (e.g. "Bench press 4x8 + incline DB press 3x10 + lateral raises 3x15"), details.duration_min, short details.notes on progression (add weight/reps week to week; deload around week ` + num(float64(max(4, in.WeeksTotal-2))) + ").",
		`- ONE mobility item per week (item_type "mobility").`,
		"- ONE meal_note item per week with practical protein guidance in details.notes (" + protein + ").",
		"- Every strength and mobility item gets details.video_query: a concise English YouTube SEARCH query for exercise form, max 80 chars. NEVER produce a youtube.com URL or a video id — only the search words.",
		newAthlete,
		"- Progressive overload across weeks: same split repeats with small load/volume increases, not new random exercises each week.",
		"- summary: 2-3 sentences describing the plan's approach.",
	}
	return Request{Prompt: joinPresent(lines, "\n"), Schema: hypertrophySchema, MaxTokens: PlanMaxTokens}
}
