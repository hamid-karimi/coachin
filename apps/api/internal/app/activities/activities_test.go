package activities

import (
	"errors"
	"strings"
	"testing"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
)

// fakeParser parses files whose content is "ok".
type fakeParser struct{}

func (fakeParser) Parse(name string, data []byte) (activity.Summary, bool) {
	return activity.Summary{Date: "2026-09-20", DistanceKm: 5, Source: name[len(name)-3:]}, string(data) == "ok"
}

func message(err error) string {
	var appErr *apperr.Error
	if errors.As(err, &appErr) && appErr.Kind == apperr.Invalid {
		return appErr.Message
	}
	return "unexpected: " + err.Error()
}

func TestParseUploads(t *testing.T) {
	svc := NewService(fakeParser{})
	ok := Upload{Name: "a.fit", Size: 2, Data: []byte("ok")}
	bad := Upload{Name: "b.gpx", Size: 3, Data: []byte("bad")}
	big := Upload{Name: "c.fit", Size: MaxFileBytes + 1}

	cases := map[string]struct {
		uploads []Upload
		want    string
	}{
		"none":     {nil, "Choose at least one .fit or .gpx file"},
		"too many": {[]Upload{ok, ok, ok, ok}, "Upload at most 3 files at a time"},
		"all fail": {[]Upload{bad, big}, "b.gpx: could not parse (use .fit or .gpx exports) · c.fit: larger than 4MB"},
	}
	for name, tc := range cases {
		if _, err := svc.Parse(tc.uploads); message(err) != tc.want {
			t.Errorf("%s: %v", name, err)
		}
	}

	parsed, err := svc.Parse([]Upload{ok, bad, ok})
	if err != nil || parsed.Status != "info" || len(parsed.Activities) != 2 ||
		parsed.Message != "2 runs parsed; skipped — b.gpx: could not parse (use .fit or .gpx exports)." {
		t.Fatalf("parsed = %+v, %v", parsed, err)
	}
	parsed, _ = svc.Parse([]Upload{ok})
	if parsed.Status != "success" || !strings.HasPrefix(parsed.Message, "1 run parsed.") {
		t.Errorf("single = %+v", parsed)
	}
}
