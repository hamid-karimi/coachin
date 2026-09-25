package aigen

import (
	"encoding/json"
	"errors"
	"strings"
)

// Photo categories the moderation gate sorts uploads into.
const (
	CategoryBodyPhoto = "body_photo"
	CategoryReport    = "analysis_report"
)

// Moderation copy (legacy lib/ai/gemini.ts moderateBodyImage).
const (
	ModerationUnavailable = "AI moderation is temporarily unavailable — try again later"
	moderationBlocked     = "Image was blocked by the safety filter"
	moderationNudity      = "This photo looks too explicit. Sports attire or athletic progress photos are fine."
	moderationOther       = "This doesn't look like a body progress photo or analysis report."
)

var moderationSchema = Schema{
	Type: Object,
	Properties: []Property{
		{"category", Schema{Type: String, Enum: []string{CategoryBodyPhoto, CategoryReport, "rejected_nudity", "rejected_other"}}},
		{"reason", Schema{Type: String}},
	},
	Required: []string{"category", "reason"},
}

// ModerationRequest classifies one normalized JPEG before it is stored:
// sports attire / athletic progress photos and body-composition reports
// pass; explicit or unrelated images don't.
func ModerationRequest(jpeg []byte) Request {
	return Request{
		Prompt: strings.Join([]string{
			"Classify this image for a fitness app's body-progress feature.",
			"Categories:",
			"- body_photo: a person in sports attire or an athletic progress photo (shirtless athletic torso is acceptable)",
			"- analysis_report: a body-composition report, scan printout, or medical-style document",
			"- rejected_nudity: explicit nudity, exposed genitals or nipples presented sexually, underwear-only in a non-athletic context",
			"- rejected_other: unrelated to fitness bodies or reports (memes, screenshots, food, etc.)",
		}, "\n"),
		Schema:    moderationSchema,
		MaxTokens: 1024,
		Images:    []Image{{MIMEType: "image/jpeg", Data: jpeg}},
		Strict:    true,
	}
}

// Moderation is the gate's verdict. Unavailable means the AI couldn't
// answer (retry later), not that the image was judged.
type Moderation struct {
	OK          bool
	Category    string
	Reason      string
	Unavailable bool
}

// rejections maps a rejected category to its copy; anything unknown is "other".
var rejections = map[string]string{"rejected_nudity": moderationNudity}

// ParseModeration reads the verdict (ok=false from the provider means
// unavailable).
func ParseModeration(res Result, ok bool) Moderation {
	if !ok {
		return Moderation{Reason: ModerationUnavailable, Unavailable: true}
	}
	if res.Blocked {
		return Moderation{Reason: moderationBlocked}
	}
	var answer struct {
		Category string `json:"category"`
	}
	if err := json.Unmarshal([]byte(res.Text), &answer); err != nil {
		return Moderation{Reason: ModerationUnavailable, Unavailable: true}
	}
	if answer.Category == CategoryBodyPhoto || answer.Category == CategoryReport {
		return Moderation{OK: true, Category: answer.Category}
	}
	if reason, known := rejections[answer.Category]; known {
		return Moderation{Reason: reason}
	}
	return Moderation{Reason: moderationOther}
}

// Analysis / extraction copy (legacy).
const (
	AnalysisUnavailable   = "AI analysis is temporarily unavailable — try again later"
	analysisUnexpected    = "AI returned an unexpected response — try again"
	ExtractionUnavailable = "AI extraction is temporarily unavailable — try again later"
)

// BodyAnalysis is the combined read of the analysis set, fed (build +
// posture notes) into the training and meal-plan prompts.
type BodyAnalysis struct {
	BuildNotes             string   `json:"build_notes"`
	PostureNotes           string   `json:"posture_notes"`
	TrainingConsiderations []string `json:"training_considerations"`
}

var bodyAnalysisSchema = Schema{
	Type: Object,
	Properties: []Property{
		{"build_notes", Schema{Type: String}},
		{"posture_notes", Schema{Type: String}},
		{"training_considerations", Schema{Type: Array, Items: &Schema{Type: String}}},
	},
	Required: []string{"build_notes", "posture_notes", "training_considerations"},
}

// BodyAnalysisRequest reads up to 5 consented body photos in one call.
func BodyAnalysisRequest(jpegs [][]byte) Request {
	images := make([]Image, len(jpegs))
	for i, data := range jpegs {
		images[i] = Image{MIMEType: "image/jpeg", Data: data}
	}
	return Request{
		Prompt: strings.Join([]string{
			"These are fitness progress photos of one person (with their consent).",
			"Give practical observations to personalize a training program and diet:",
			"build_notes (general build, 1-2 sentences), posture_notes (visible posture",
			"observations, 1-2 sentences), training_considerations (2-4 short bullets).",
			"Do NOT estimate body-fat percentages or diagnose anything medical.",
		}, " "),
		Schema:    bodyAnalysisSchema,
		MaxTokens: 2048,
		Images:    images,
		Strict:    true,
	}
}

// ParseBodyAnalysis validates the answer's shape; the error text is shown.
func ParseBodyAnalysis(res Result, ok bool) (BodyAnalysis, error) {
	if !ok || res.Blocked {
		return BodyAnalysis{}, errors.New(AnalysisUnavailable)
	}
	var raw struct {
		BuildNotes             *string `json:"build_notes"`
		PostureNotes           *string `json:"posture_notes"`
		TrainingConsiderations []any   `json:"training_considerations"`
	}
	if err := json.Unmarshal([]byte(res.Text), &raw); err != nil {
		return BodyAnalysis{}, errors.New(AnalysisUnavailable)
	}
	if raw.BuildNotes == nil || raw.PostureNotes == nil || raw.TrainingConsiderations == nil {
		return BodyAnalysis{}, errors.New(analysisUnexpected)
	}
	out := BodyAnalysis{BuildNotes: *raw.BuildNotes, PostureNotes: *raw.PostureNotes, TrainingConsiderations: []string{}}
	for _, item := range raw.TrainingConsiderations {
		if s, isString := item.(string); isString {
			out.TrainingConsiderations = append(out.TrainingConsiderations, s)
		}
	}
	return out, nil
}

// ReportMetrics is what a body-composition report photo says (nil when not
// clearly readable).
type ReportMetrics struct {
	WeightKg     *float64 `json:"weight_kg"`
	BodyFatPct   *float64 `json:"body_fat_pct"`
	MuscleMassKg *float64 `json:"muscle_mass_kg"`
	Notes        string   `json:"notes"`
}

var reportSchema = Schema{
	Type: Object,
	Properties: []Property{
		{"weight_kg", Schema{Type: Number, Nullable: true}},
		{"body_fat_pct", Schema{Type: Number, Nullable: true}},
		{"muscle_mass_kg", Schema{Type: Number, Nullable: true}},
		{"notes", Schema{Type: String}},
	},
	Required: []string{"notes"},
}

// ReportRequest extracts metrics from one report photo.
func ReportRequest(jpeg []byte) Request {
	return Request{
		Prompt:    "Extract body-composition metrics from this report image. Use null for anything not clearly readable. Convert to metric units (kg, %).",
		Schema:    reportSchema,
		MaxTokens: 1024,
		Images:    []Image{{MIMEType: "image/jpeg", Data: jpeg}},
	}
}

// ParseReportMetrics keeps only numeric values (legacy typeof checks).
func ParseReportMetrics(res Result, ok bool) (ReportMetrics, error) {
	if !ok || res.Blocked {
		return ReportMetrics{}, errors.New(ExtractionUnavailable)
	}
	var raw map[string]any
	if err := json.Unmarshal([]byte(res.Text), &raw); err != nil {
		return ReportMetrics{}, errors.New(ExtractionUnavailable)
	}
	number := func(key string) *float64 {
		if v, isNumber := raw[key].(float64); isNumber {
			return &v
		}
		return nil
	}
	notes, _ := raw["notes"].(string)
	return ReportMetrics{WeightKg: number("weight_kg"), BodyFatPct: number("body_fat_pct"), MuscleMassKg: number("muscle_mass_kg"), Notes: notes}, nil
}
