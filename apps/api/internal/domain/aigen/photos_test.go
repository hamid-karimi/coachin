package aigen

import "testing"

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
