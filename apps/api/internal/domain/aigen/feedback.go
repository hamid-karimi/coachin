package aigen

import (
	"bytes"
	"encoding/json"
	"errors"
	"regexp"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Flag grades a logged session: fine, take care, or possible injury.
type Flag string

// Session flags, mildest first.
const (
	FlagOK      Flag = "ok"
	FlagCaution Flag = "caution"
	FlagRed     Flag = "red"
)

var severity = map[Flag]int{FlagOK: 0, FlagCaution: 1, FlagRed: 2}

// Session feedback outcomes (legacy copy).
var (
	ErrFeedbackUnavailable = errors.New("AI feedback is temporarily unavailable — try again later")
	ErrFeedbackUnexpected  = errors.New("AI returned an unexpected response")
)

var (
	painPattern   = regexp.MustCompile(`(?i)pain|hurt|injur|schmerz|verletz`)
	severePattern = regexp.MustCompile(`(?i)sharp|severe|stark`)
)

// RedFlagPrecheck is the deterministic grade that runs before the AI: pain
// in the note is caution (red with RPE ≥ 8 or a severe word); RPE ≥ 9
// alone is caution.
func RedFlagPrecheck(note *string, rpe *int) Flag {
	if note != nil && painPattern.MatchString(*note) {
		if (rpe != nil && *rpe >= 8) || severePattern.MatchString(*note) {
			return FlagRed
		}
		return FlagCaution
	}
	if rpe != nil && *rpe >= 9 {
		return FlagCaution
	}
	return FlagOK
}

// Feedback is the validated AI comment on a logged session.
type Feedback struct {
	Message string `json:"message"`
	Flag    Flag   `json:"flag"`
}

// FeedbackInput is a logged session and its plan item. Planned and Actual
// are JSON objects (Planned may be empty/null).
type FeedbackInput struct {
	ItemTitle string
	ItemType  string
	Planned   json.RawMessage
	Actual    json.RawMessage
	RPE       *int
	Note      *string
}

var feedbackSchema = Schema{
	Type: Object,
	Properties: []Property{
		{"message", Schema{Type: String}},
		{"flag", Schema{Type: String, Enum: []string{"ok", "caution", "red"}}},
	},
	Required: []string{"message", "flag"},
}

// compactJSON renders raw like JSON.stringify of its parse (key order kept);
// empty or null becomes fallback.
func compactJSON(raw json.RawMessage, fallback string) string {
	var b bytes.Buffer
	if len(bytes.TrimSpace(raw)) == 0 || json.Compact(&b, raw) != nil || b.String() == "null" {
		return fallback
	}
	return b.String()
}

// SessionFeedbackRequest builds the "how did it go" feedback request.
func SessionFeedbackRequest(in FeedbackInput) Request {
	rpe := "not given"
	if in.RPE != nil {
		rpe = num(float64(*in.RPE))
	}
	note := "none"
	if in.Note != nil {
		note = *in.Note
	}
	lines := []string{
		"An athlete just logged a training session. Give short, supportive feedback.",
		`Planned session: "` + in.ItemTitle + `" (` + in.ItemType + `). Planned details: ` + compactJSON(in.Planned, "{}") + ".",
		"Actual result: " + compactJSON(in.Actual, "{}") + ".",
		"Perceived effort (RPE 1-10): " + rpe + ".",
		"Athlete's note: " + note + ".",
		"Rules:",
		"- Compare planned vs actual and the effort; at most 2 sentences plus ONE actionable tip.",
		`- flag: "ok" if all is fine, "caution" if effort/deviation warrants care, "red" if pain or possible injury is indicated.`,
		"- If pain or injury is mentioned, advise easing off and seeing a professional. NEVER diagnose or prescribe medical treatment.",
	}
	return Request{Prompt: strings.Join(lines, "\n"), Schema: feedbackSchema, MaxTokens: 1024}
}

// ParseFeedback validates the answer; the AI can raise the pre-check's flag
// but never lower it, and an unknown flag reads as caution.
func ParseFeedback(text string, precheck Flag) (Feedback, error) {
	var raw any
	if err := json.Unmarshal([]byte(text), &raw); err != nil || raw == nil {
		return Feedback{}, ErrFeedbackUnavailable
	}
	message, _ := jsnum.Field(raw, "message").(string)
	message = jsnum.Slice(jsnum.Trim(message), 300)
	if message == "" {
		return Feedback{}, ErrFeedbackUnexpected
	}
	flag := Flag(jsnum.ToString(jsnum.Field(raw, "flag")))
	if _, known := severity[flag]; !known {
		flag = FlagCaution
	}
	if severity[precheck] >= severity[flag] {
		flag = precheck
	}
	return Feedback{Message: message, Flag: flag}, nil
}
