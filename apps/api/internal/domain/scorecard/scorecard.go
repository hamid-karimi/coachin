// Package scorecard is the weekly training scorecard, the check-in decision
// rules, and hypertrophy stall detection (FORMULAS.md §7). Rules only — no AI.
package scorecard

import (
	"fmt"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/workout"
)

// Item is the part of a plan item the scorecard reads.
type Item struct {
	ItemType    string         `json:"item_type"`
	IsCompleted bool           `json:"is_completed"`
	Details     map[string]any `json:"details"`
}

// SessionLog is the part of a session log the scorecard reads.
type SessionLog struct {
	Actual     map[string]any `json:"actual"`
	AIFeedback map[string]any `json:"ai_feedback"`
	Note       *string        `json:"note"`
}

// Week is one plan week's scorecard.
type Week struct {
	// AdherencePct is completed / planned non-meal items, 0–100, one decimal.
	AdherencePct   float64  `json:"adherence_pct"`
	PlannedItems   int      `json:"planned_items"`
	CompletedItems int      `json:"completed_items"`
	PlannedKm      float64  `json:"planned_km"`
	ActualKm       float64  `json:"actual_km"`
	RedFlags       []string `json:"red_flags"`
	CautionFlags   []string `json:"caution_flags"`
}

func round1(x float64) float64 { return jsnum.Round(x*10) / 10 }

// positive reads a JSON number > 0 (strings don't count).
func positive(v any) (float64, bool) {
	n, ok := v.(float64)
	return n, ok && n > 0
}

// ComputeWeek scores a week. logs[i] is items[i]'s session log (nil when it
// has none), so a completed run without a logged distance counts its planned
// distance.
func ComputeWeek(items []Item, logs []*SessionLog) Week {
	week := Week{AdherencePct: 100, RedFlags: []string{}, CautionFlags: []string{}}

	var plannedKm, actualKm float64
	for i, item := range items {
		if item.ItemType != "meal_note" {
			week.PlannedItems++
			if item.IsCompleted {
				week.CompletedItems++
			}
		}
		if item.ItemType != "run" {
			continue
		}
		planned, hasPlanned := positive(item.Details["distance_km"])
		if hasPlanned {
			plannedKm += planned
		}
		var log *SessionLog
		if i < len(logs) {
			log = logs[i]
		}
		if log != nil {
			if logged, ok := positive(log.Actual["distance_km"]); ok {
				actualKm += logged
				continue
			}
		}
		if item.IsCompleted && hasPlanned {
			actualKm += planned
		}
	}
	// No planned items means nothing could be missed: full adherence.
	if week.PlannedItems > 0 {
		week.AdherencePct = round1(float64(week.CompletedItems) / float64(week.PlannedItems) * 100)
	}
	week.PlannedKm, week.ActualKm = round1(plannedKm), round1(actualKm)

	flagged := map[string]*[]string{"red": &week.RedFlags, "caution": &week.CautionFlags}
	for _, log := range logs {
		if log == nil || log.AIFeedback == nil {
			continue
		}
		flag := ""
		if v := log.AIFeedback["flag"]; v != nil {
			flag = jsnum.ToString(v)
		}
		list, ok := flagged[flag]
		if !ok {
			continue
		}
		*list = append(*list, flagText(log))
	}
	return week
}

// flagText is the note, else the AI message, else a generic label.
func flagText(log *SessionLog) string {
	if log.Note != nil {
		if note := jsnum.Trim(*log.Note); note != "" {
			return note
		}
	}
	if message, ok := log.AIFeedback["message"].(string); ok {
		if trimmed := jsnum.Trim(message); trimmed != "" {
			return trimmed
		}
	}
	return "Flagged session"
}

// Decision is what a check-in does with next week.
type Decision string

// Check-in decisions.
const (
	Advance Decision = "advance"
	Repeat  Decision = "repeat"
	Deload  Decision = "deload"
)

// Result is a decision with the human-readable reasons behind it.
type Result struct {
	Decision Decision `json:"decision"`
	Reasons  []string `json:"reasons"`
}

// Decide applies the rules, first match wins: a red flag → deload; two weeks
// in a row under 50% adherence → deload; one → repeat; otherwise advance.
func Decide(current Week, previous *Week) Result {
	pct := jsnum.FormatNumber
	if len(current.RedFlags) > 0 {
		return Result{Deload, []string{
			// Plain quotes, not %q: the note is shown verbatim, never escaped.
			`A session was red-flagged: "` + current.RedFlags[0] + `" — easing off to recover.`,
		}}
	}
	if current.AdherencePct < 50 {
		if previous != nil && previous.AdherencePct < 50 {
			return Result{Deload, []string{fmt.Sprintf(
				"Two weeks in a row under 50%% adherence (%s%% then %s%%) — a lighter deload week rebuilds momentum.",
				pct(previous.AdherencePct), pct(current.AdherencePct))}}
		}
		return Result{Repeat, []string{fmt.Sprintf(
			"Only %d of %d sessions done (%s%%) — repeating the week instead of advancing.",
			current.CompletedItems, current.PlannedItems, pct(current.AdherencePct))}}
	}
	reasons := []string{fmt.Sprintf("%d of %d sessions done (%s%%) — on track to advance.",
		current.CompletedItems, current.PlannedItems, pct(current.AdherencePct))}
	if n := len(current.CautionFlags); n > 0 {
		plural := "s"
		if n == 1 {
			plural = ""
		}
		reasons = append(reasons, fmt.Sprintf("Heads up: %d session%s flagged for caution.", n, plural))
	}
	return Result{Advance, reasons}
}

type best struct{ weight, reps float64 }

// StalledLifts names exercises logged in each of the last three weeks with no
// weight or rep increase from the first of those weeks to the last. Pass
// per-week strength logs oldest → newest; fewer than three weeks → none.
func StalledLifts(weeks [][]*SessionLog) []string {
	stalled := []string{}
	if len(weeks) < 3 {
		return stalled
	}
	lastThree := weeks[len(weeks)-3:]
	bests := make([]map[string]best, 3)
	var firstWeekOrder []string // names in first-logged order

	for w, logs := range lastThree {
		bests[w] = map[string]best{}
		for _, log := range logs {
			var raw any
			if log != nil {
				raw = log.Actual["exercises"]
			}
			for _, exercise := range workout.NormalizeLoggedExercises(raw) {
				name := strings.ToLower(exercise.Name)
				for _, set := range exercise.Sets {
					weight, _ := positive(set.WeightKg)
					reps, _ := positive(float64(set.Reps))
					current, seen := bests[w][name]
					if !seen && w == 0 {
						firstWeekOrder = append(firstWeekOrder, name)
					}
					if !seen || weight > current.weight || (weight == current.weight && reps > current.reps) {
						bests[w][name] = best{weight, reps}
					}
				}
			}
		}
	}

	for _, name := range firstWeekOrder {
		first := bests[0][name]
		_, inMid := bests[1][name]
		last, inLast := bests[2][name]
		if inMid && inLast && last.weight <= first.weight && last.reps <= first.reps {
			stalled = append(stalled, name)
		}
	}
	return stalled
}
