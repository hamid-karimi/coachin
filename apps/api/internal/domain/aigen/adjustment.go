package aigen

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Week adjustment outcomes (legacy copy).
var (
	ErrAdjustmentUnavailable = errors.New("AI adjustment is temporarily unavailable — try again later")
	ErrAdjustmentNoItems     = errors.New("AI returned no usable items")
	ErrAdjustmentNoSummary   = errors.New("AI returned no summary")
)

var decisionRules = map[string]string{
	"deload":  "DELOAD: reduce total volume by roughly 30-40% (shorter runs, easier paces, lighter strength). Keep the athlete moving but recovering.",
	"repeat":  "REPEAT: mirror the structure and volume of the reviewed week — do not progress. The athlete needs another pass at this load.",
	"advance": "ADVANCE: apply a light progression (<=10% volume increase) to the given items; keep the same session types.",
}

// AdjustmentInput is one check-in: the reviewed week's scorecard (JSON), the
// deterministic decision and its reasons, and next week's items.
type AdjustmentInput struct {
	Scorecard     json.RawMessage
	Decision      string
	Reasons       []string
	NextWeekItems []PlanItemInput
	TargetWeek    int
	IntakeSummary string
}

// adjustmentSchema is the plan item shape without a description (as the
// legacy week rewrite asked for).
var adjustmentSchema = planSchema(Schema{
	Type: Object,
	Properties: []Property{
		{"week", Schema{Type: Integer}},
		{"day_of_week", Schema{Type: Integer}},
		{"item_type", Schema{Type: String, Enum: []string{"run", "strength", "stretch", "recovery", "meal_note"}}},
		{"title", Schema{Type: String}},
		{"details", Schema{Type: Object, Properties: []Property{
			{"distance_km", nullable(Number)},
			{"pace_min_km", nullable(String)},
			{"duration_min", nullable(Number)},
			{"notes", nullable(String)},
		}}},
	},
	Required: []string{"week", "day_of_week", "item_type", "title"},
})

// WeekAdjustmentRequest asks the AI to rewrite one week within the decision.
func WeekAdjustmentRequest(in AdjustmentInput) Request {
	next, _ := json.Marshal(in.NextWeekItems)
	context := in.IntakeSummary
	if context == "" {
		context = "unknown"
	}
	week := num(float64(in.TargetWeek))
	lines := []string{
		"You are adjusting ONE week of an existing training plan after a weekly review.",
		"Plan context: " + context + ".",
		"Reviewed week scorecard: " + compactJSON(in.Scorecard, "null") + ".",
		"Deterministic decision (already made — do NOT change it): " + in.Decision + ".",
		"Reasons: " + strings.Join(in.Reasons, " "),
		"Current items of the week to rewrite (week " + week + "):",
		string(next),
		"Rules:",
		"- " + decisionRules[in.Decision],
		"- Rewrite ONLY these items; keep the same number of training days and the same day_of_week pattern.",
		"- Every item: week = " + week + ", same item schema (run items keep details.distance_km, details.pace_min_km, details.notes).",
		"- summary: at most 2 sentences explaining what changed and why, in plain language.",
	}
	return Request{Prompt: strings.Join(lines, "\n"), Schema: adjustmentSchema}
}

// ParseAdjustment validates the rewritten week and forces every item onto
// targetWeek (the AI's week numbers are never trusted).
func ParseAdjustment(text string, targetWeek int) ([]PlanItemInput, string, error) {
	var raw any
	if err := json.Unmarshal([]byte(text), &raw); err != nil || raw == nil {
		return nil, "", ErrAdjustmentUnavailable
	}
	items := ValidateItems(jsnum.Field(raw, "items"))
	for i := range items {
		items[i].Week = targetWeek
	}
	if len(items) == 0 {
		return nil, "", ErrAdjustmentNoItems
	}
	summary := jsnum.Field(raw, "summary")
	if _, missing := summary.(jsnum.Missing); missing || summary == nil {
		summary = ""
	}
	text = jsnum.Slice(jsnum.Trim(jsnum.ToString(summary)), 500)
	if text == "" {
		return nil, "", ErrAdjustmentNoSummary
	}
	return items, text, nil
}
