package aigen

import (
	"encoding/json"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type aiCase struct {
	Fn         string          `json:"fn"`
	Text       *string         `json:"text"`
	Anchors    []Anchor        `json:"anchors"`
	Raw        json.RawMessage `json:"raw"`
	Intake     json.RawMessage `json:"intake"`
	Prompt     string          `json:"prompt"`
	MaxTokens  int             `json:"maxTokens"`
	SchemaHint string          `json:"schemaHint"`
	WeeksTotal int             `json:"weeksTotal"`
	Want       json.RawMessage `json:"want"`
}

func checkRequest(t *testing.T, i int, got Request, c aiCase) {
	t.Helper()
	if got.Prompt != c.Prompt {
		t.Errorf("case %d %s: prompt differs\n got: %q\nwant: %q", i, c.Fn, got.Prompt, c.Prompt)
	}
	if got.MaxTokens != c.MaxTokens {
		t.Errorf("case %d: max tokens %d, want %d", i, got.MaxTokens, c.MaxTokens)
	}
	if hint := Hint(got.Schema); hint != c.SchemaHint {
		t.Errorf("case %d: schema hint\n got: %s\nwant: %s", i, hint, c.SchemaHint)
	}
}

func TestMatchesLegacy(t *testing.T) {
	counts := map[string]int{}
	for i, c := range golden.Load[aiCase](t, "ai") {
		counts[c.Fn]++
		switch c.Fn {
		case "extractJson":
			text := ""
			if c.Text != nil {
				text = *c.Text
			}
			got, ok := ExtractJSON(text)
			if equal, diff := golden.Equal(t, golden.OrNull(got, ok), c.Want); !equal {
				t.Errorf("case %d ExtractJSON(%q): %s", i, text, diff)
			}
		case "anchorsPromptBlock":
			if equal, diff := golden.Equal(t, AnchorsPromptBlock(c.Anchors), c.Want); !equal {
				t.Errorf("case %d: %s", i, diff)
			}
		case "validateItems":
			var raw any
			_ = json.Unmarshal(c.Raw, &raw)
			if equal, diff := golden.Equal(t, ValidateItems(raw), c.Want); !equal {
				t.Errorf("case %d ValidateItems: %s", i, diff)
			}
		case "marathonRequest":
			checkRequest(t, i, MarathonRequest(golden.Decode[MarathonIntake](t, c.Intake)), c)
		case "hypertrophyRequest":
			checkRequest(t, i, HypertrophyRequest(golden.Decode[HypertrophyIntake](t, c.Intake)), c)
		case "planResult":
			plan, err := ParsePlan(*c.Text, c.WeeksTotal)
			var got any = map[string]string{"error": errMessage(err)}
			if err == nil {
				got = map[string]any{"summary": plan.Summary, "items": plan.Items, "model": "test-model"}
			}
			if equal, diff := golden.Equal(t, got, c.Want); !equal {
				t.Errorf("case %d ParsePlan: %s", i, diff)
			}
		default:
			t.Fatalf("case %d: unknown fn %q", i, c.Fn)
		}
	}
	for _, fn := range []string{"extractJson", "anchorsPromptBlock", "validateItems", "marathonRequest", "hypertrophyRequest", "planResult"} {
		if counts[fn] == 0 {
			t.Errorf("no %s vectors", fn)
		}
	}
}

func errMessage(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}
