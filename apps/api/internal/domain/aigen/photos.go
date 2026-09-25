package aigen

import (
	"encoding/json"
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
