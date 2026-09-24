package aigen

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Plan generation outcomes shown to the user (legacy copy).
var (
	ErrUnavailable = errors.New("AI plan generation is temporarily unavailable (quota or network) — try again later")
	ErrIncomplete  = errors.New("AI returned an incomplete plan — try again")
)

// PlanMaxTokens is the output ceiling for plan generation.
const PlanMaxTokens = 24000

// Request is one generation call: the prompt, the shape of the answer, and
// the output ceiling.
type Request struct {
	Prompt    string
	Schema    Schema
	MaxTokens int
	// Images go before the prompt (vision requests).
	Images []Image
}

// Image is an inline image for a vision prompt.
type Image struct {
	MIMEType string
	Data     []byte
}

// Result is generated JSON and the model that produced it.
type Result struct {
	Text  string
	Model string
}

// GeneratedPlan is a parsed, validated plan.
type GeneratedPlan struct {
	Summary string
	Items   []PlanItemInput
	Raw     json.RawMessage
}

// ParsePlan reads a plan answer: {summary, items}. Items are validated; fewer
// than 3 per week means the model gave up part-way (ErrIncomplete).
func ParsePlan(text string, weeksTotal int) (GeneratedPlan, error) {
	var raw any
	if err := json.Unmarshal([]byte(text), &raw); err != nil {
		return GeneratedPlan{}, ErrUnavailable
	}
	items := ValidateItems(jsnum.Field(raw, "items"))
	if len(items) < weeksTotal*3 {
		return GeneratedPlan{}, ErrIncomplete
	}
	summary := jsnum.Field(raw, "summary")
	if _, missing := summary.(jsnum.Missing); missing || summary == nil {
		summary = ""
	}
	return GeneratedPlan{Summary: jsnum.Slice(jsnum.ToString(summary), 1000), Items: items, Raw: json.RawMessage(text)}, nil
}

// num formats a number as a JavaScript template literal would.
func num(x float64) string { return jsnum.FormatNumber(x) }

// joinPresent joins the non-empty parts (JavaScript's .filter(Boolean)).
func joinPresent(parts []string, sep string) string {
	present := parts[:0:0]
	for _, p := range parts {
		if p != "" {
			present = append(present, p)
		}
	}
	return strings.Join(present, sep)
}

// athleteLine is "age 38, female, 168.5cm, 61kg" (falsy values skipped).
func athleteLine(age *int, sex *string, heightCm, weightKg *float64) string {
	var parts []string
	if age != nil && *age != 0 {
		parts = append(parts, "age "+num(float64(*age)))
	}
	if sex != nil {
		parts = append(parts, *sex)
	}
	if heightCm != nil && *heightCm != 0 {
		parts = append(parts, num(*heightCm)+"cm")
	}
	if weightKg != nil && *weightKg != 0 {
		parts = append(parts, num(*weightKg)+"kg")
	}
	return joinPresent(parts, ", ")
}

func orUnknown(s *string) string {
	if s == nil || *s == "" {
		return "unknown"
	}
	return *s
}

func orText(s *string, fallback string) string {
	if s == nil || *s == "" {
		return fallback
	}
	return *s
}

func numOrUnknown(x *float64) string {
	if x == nil {
		return "unknown"
	}
	return num(*x)
}

// itemSchema is the per-item shape; plans differ only in item types and
// detail fields.
func itemSchema(types []string, details []Property) Schema {
	return Schema{
		Type: Object,
		Properties: []Property{
			{"week", Schema{Type: Integer}},
			{"day_of_week", Schema{Type: Integer}},
			{"item_type", Schema{Type: String, Enum: types}},
			{"title", Schema{Type: String}},
			{"description", Schema{Type: String, Nullable: true}},
			{"details", Schema{Type: Object, Properties: details}},
		},
		Required: []string{"week", "day_of_week", "item_type", "title"},
	}
}

func planSchema(item Schema) Schema {
	return Schema{
		Type: Object,
		Properties: []Property{
			{"summary", Schema{Type: String}},
			{"items", Schema{Type: Array, Items: &item}},
		},
		Required: []string{"summary", "items"},
	}
}

func nullable(t Type) Schema { return Schema{Type: t, Nullable: true} }

// Activity is an uploaded run as the prompts describe it (the activity
// import summary shape).
type Activity = activity.Summary
