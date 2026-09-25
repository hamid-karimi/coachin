package aigen

import (
	"strings"
	"testing"
)

func TestModeration(t *testing.T) {
	req := ModerationRequest([]byte{1, 2})
	if !req.Strict || len(req.Images) != 1 || req.Images[0].MIMEType != "image/jpeg" || req.Schema.Required[0] != "category" {
		t.Fatalf("request = %+v", req)
	}
	cases := []struct {
		name string
		res  Result
		ok   bool
		want Moderation
	}{
		{"body", Result{Text: `{"category":"body_photo","reason":"athletic"}`}, true, Moderation{OK: true, Category: CategoryBodyPhoto}},
		{"report", Result{Text: `{"category":"analysis_report","reason":"scan"}`}, true, Moderation{OK: true, Category: CategoryReport}},
		{"nudity", Result{Text: `{"category":"rejected_nudity","reason":"x"}`}, true, Moderation{Reason: moderationNudity}},
		{"other", Result{Text: `{"category":"rejected_other","reason":"meme"}`}, true, Moderation{Reason: moderationOther}},
		{"unknown category", Result{Text: `{"category":"cat"}`}, true, Moderation{Reason: moderationOther}},
		{"blocked", Result{Blocked: true}, true, Moderation{Reason: moderationBlocked}},
		{"bad json", Result{Text: `nope`}, true, Moderation{Reason: ModerationUnavailable, Unavailable: true}},
		{"no provider", Result{}, false, Moderation{Reason: ModerationUnavailable, Unavailable: true}},
	}
	for _, c := range cases {
		if got := ParseModeration(c.res, c.ok); got != c.want {
			t.Errorf("%s: %+v, want %+v", c.name, got, c.want)
		}
	}
}

func TestBodyAnalysis(t *testing.T) {
	req := BodyAnalysisRequest([][]byte{{1}, {2}})
	if !req.Strict || len(req.Images) != 2 || !strings.Contains(req.Prompt, "Do NOT estimate body-fat percentages") {
		t.Fatalf("request = %+v", req)
	}
	got, err := ParseBodyAnalysis(Result{Text: `{"build_notes":"Lean","posture_notes":"Upright","training_considerations":["Hips",3,"Core"]}`}, true)
	if err != nil || got.BuildNotes != "Lean" || len(got.TrainingConsiderations) != 2 {
		t.Fatalf("parse = %+v, %v", got, err)
	}
	for text, want := range map[string]string{
		`{"build_notes":"Lean"}`: analysisUnexpected,
		`nope`:                   AnalysisUnavailable,
	} {
		if _, err := ParseBodyAnalysis(Result{Text: text}, true); err == nil || err.Error() != want {
			t.Errorf("%s: %v", text, err)
		}
	}
	if _, err := ParseBodyAnalysis(Result{}, false); err == nil || err.Error() != AnalysisUnavailable {
		t.Errorf("no provider: %v", err)
	}
}

func TestReportMetrics(t *testing.T) {
	if req := ReportRequest([]byte{1}); req.Strict || len(req.Images) != 1 || req.Schema.Properties[0].Schema.Nullable != true {
		t.Fatalf("request = %+v", req)
	}
	got, err := ParseReportMetrics(Result{Text: `{"weight_kg":72.4,"body_fat_pct":"18","muscle_mass_kg":null,"notes":"InBody 570"}`}, true)
	if err != nil || *got.WeightKg != 72.4 || got.BodyFatPct != nil || got.MuscleMassKg != nil || got.Notes != "InBody 570" {
		t.Fatalf("parse = %+v, %v", got, err)
	}
	if _, err := ParseReportMetrics(Result{Text: "x"}, true); err == nil || err.Error() != ExtractionUnavailable {
		t.Errorf("bad json: %v", err)
	}
}
