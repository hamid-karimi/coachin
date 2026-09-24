package aigen

import (
	"strings"
)

// MarathonIntake is a running plan's intake, stored as training_plans.intake.
type MarathonIntake struct {
	PlanKind            string     `json:"plan_kind"` // "race"
	RaceDate            *string    `json:"race_date"` // nil for a base plan
	RaceTarget          string     `json:"race_target"`
	RaceDistanceKm      float64    `json:"race_distance_km"` // 0 for a base plan
	ExperienceLevel     *string    `json:"experience_level"`
	FirstTimeAtDistance bool       `json:"first_time_at_distance"`
	GoalTime            *string    `json:"goal_time"`
	WeeksTotal          int        `json:"weeks_total"`
	DaysPerWeek         int        `json:"days_per_week"`
	PB5k                *string    `json:"pb_5k"`
	PB10k               *string    `json:"pb_10k"`
	PBHalf              *string    `json:"pb_half"`
	PBFull              *string    `json:"pb_full"`
	WeeklyKm            *float64   `json:"weekly_km"`
	LongestRunKm        *float64   `json:"longest_run_km"`
	Injuries            *string    `json:"injuries"`
	Age                 *int       `json:"age"`
	Sex                 *string    `json:"sex"`
	HeightCm            *float64   `json:"height_cm"`
	WeightKg            *float64   `json:"weight_kg"`
	TrainingHistory     *string    `json:"training_history"`
	Activities          []Activity `json:"activities"`
	Anchors             []Anchor   `json:"anchors"`
}

var experienceText = map[string]string{
	"new":          "new to structured running (build from walk/run basics, prioritize consistency over speed)",
	"recreational": "recreational runner (runs casually, little structured training)",
	"regular":      "regular racer (trains consistently, has raced before)",
	"competitive":  "competitive runner (high volume, structured training background)",
}

var marathonSchema = planSchema(itemSchema(
	[]string{"run", "strength", "stretch", "mobility", "recovery", "meal_note"},
	[]Property{
		{"distance_km", nullable(Number)},
		{"pace_min_km", nullable(String)},
		{"duration_min", nullable(Number)},
		{"notes", nullable(String)},
		{"video_query", nullable(String)},
	},
))

// MarathonRequest builds the running-plan generation request (base-building
// or race).
func MarathonRequest(in MarathonIntake) Request {
	athlete := athleteLine(in.Age, in.Sex, in.HeightCm, in.WeightKg)

	pbs := joinPresent([]string{
		prefixed("5k ", in.PB5k), prefixed("10k ", in.PB10k), prefixed("half ", in.PBHalf), prefixed("marathon ", in.PBFull),
	}, ", ")

	recent := "none provided"
	if len(in.Activities) > 0 {
		runs := in.Activities
		if len(runs) > 20 {
			runs = runs[:20]
		}
		lines := make([]string, len(runs))
		for i, a := range runs {
			lines[i] = a.Date + ": " + num(a.DistanceKm) + "km in " + num(a.DurationMin) + "min"
			if a.AvgHR != nil && *a.AvgHR != 0 {
				lines[i] += " (avg HR " + num(*a.AvgHR) + ")"
			}
		}
		recent = strings.Join(lines, "; ")
	}

	experience := "unknown experience level"
	if in.ExperienceLevel != nil {
		if text, ok := experienceText[*in.ExperienceLevel]; ok {
			experience = text
		}
	}
	newRunner := in.ExperienceLevel != nil && *in.ExperienceLevel == "new"

	strengthRule := `- Strength items must be RUNNER-SPECIFIC — hips, glutes, calves, core, with a single-leg bias — short title (e.g. "Strength — single-leg focus") and the concrete exercise list with sets x reps in "description" (e.g. "Single-leg RDL 3x10 + calf raises 3x15 + side plank 3x30s").`
	if newRunner {
		strengthRule += " The athlete is new: bodyweight-first strength, no barbell work."
	}
	commonRules := []string{
		"- Exactly " + num(float64(in.DaysPerWeek)) + " training days per week (day_of_week: 0=Sunday..6=Saturday); remaining days get ONE recovery item.",
		`- Every item: "title" is a SHORT human-readable session name, max 60 characters (e.g. "Easy run 5k", "Strength — hips & core", "Long run 18k"). Put the full exercise list and session detail in "description" — NEVER in the title.`,
		`- Every run item: details.distance_km, details.pace_min_km (like "5:40"), short details.notes.`,
		`- Add ONE meal_note item per week (day_of_week of the long run) with practical fueling guidance in details.notes.`,
		strengthRule,
		`- Every strength, stretch and mobility item (and run items with drills) gets details.video_query: a concise English YouTube SEARCH query for exercise form (e.g. "single leg romanian deadlift form"), max 80 chars. NEVER produce a youtube.com URL or a video id — only the search words.`,
		`- Respect the athlete's current volume: never jump weekly km more than ~10%.`,
		`- summary: 2-3 sentences describing the plan's approach.`,
	}

	athleteText := athlete
	if athleteText == "" {
		athleteText = "unknown"
	}
	pbText := pbs
	if pbText == "" {
		pbText = "none"
	}
	profile := "Athlete: " + athleteText + ". Experience: " + experience + ". Training history: " + orUnknown(in.TrainingHistory) + "."
	volume := "PBs: " + pbText + ". Current weekly volume: " + numOrUnknown(in.WeeklyKm) + "km, longest recent run " + numOrUnknown(in.LongestRunKm) + "km."
	injuries := "Injuries/limitations: " + orText(in.Injuries, "none reported") + "."
	anchors := AnchorsPromptBlock(in.Anchors)
	weeks := num(float64(in.WeeksTotal))

	var lines []string
	if in.RaceTarget == "base" {
		lines = []string{
			"Create a " + weeks + "-week BASE-BUILDING running plan for someone who just wants to start running and build a consistent, injury-free habit. There is NO race and NO goal time — do NOT include a taper, goal-pace work, or race-specific peaking.",
			profile,
			volume,
			"Recent uploaded runs: " + recent + ".",
			injuries,
			anchors,
			"Rules:",
			`- Weekly structure: mostly EASY, conversational-pace runs (use run/walk intervals for a new runner), ONE slightly longer run that grows gently, strength 1-2x, stretch 1x, and ONE mobility item (item_type "mobility": hip/ankle mobility or yoga-for-runners).`,
			`- Progress volume gradually week over week with a lighter "stepback" every 4th week; keep intensity low — the goal is aerobic base and consistency, not speed.`,
			`- Titles short and concrete ("Easy run 4k", "Run/walk 30min", "Easy run 6k").`,
		}
	} else {
		distance := num(in.RaceDistanceKm)
		firstTime := ""
		if in.FirstTimeAtDistance {
			firstTime = "This is the athlete's FIRST race at this distance — no PB at or beyond " + distance + "km. Prioritize finishing healthy over time goals; be conservative with volume and pace targets."
		}
		raceDate := "null"
		if in.RaceDate != nil {
			raceDate = *in.RaceDate
		}
		lines = []string{
			"Create a " + weeks + "-week training plan for a " + distance + "km race (" + in.RaceTarget + ").",
			profile,
			firstTime,
			volume,
			"Recent uploaded runs: " + recent + ".",
			"Race date: " + raceDate + ". Goal time: " + orText(in.GoalTime, "finish comfortably") + ".",
			injuries,
			anchors,
			"Rules:",
			`- Weekly structure: quality run(s), easy runs, one long run (progressing, stepback every 4th week, taper appropriately for the race distance), strength 1-2x, stretch 1x, and ONE mobility item (item_type "mobility": hip/ankle mobility or yoga-for-runners).`,
			"- Scale everything to the " + distance + "km target: long-run peaks, interval distances, and taper length must fit the race distance and the athlete's experience level.",
			`- Titles short and concrete ("Easy run 8k", "Intervals 6x800m", "Long run 26k").`,
		}
	}
	lines = append(lines, commonRules...)
	return Request{Prompt: joinPresent(lines, "\n"), Schema: marathonSchema, MaxTokens: PlanMaxTokens}
}

// prefixed is label+value, or "" when the value is missing or empty.
func prefixed(label string, value *string) string {
	if value == nil || *value == "" {
		return ""
	}
	return label + *value
}
