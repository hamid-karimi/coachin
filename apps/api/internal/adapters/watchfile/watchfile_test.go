package watchfile

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/golden"
)

type fileCase struct {
	File string          `json:"file"`
	Want json.RawMessage `json:"want"`
}

// The fixtures and their expected summaries come from running the legacy
// parsers (scripts/golden/activity-files.ts).
func TestGoldenWatchFiles(t *testing.T) {
	parser := New(func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) })
	for _, c := range golden.Load[fileCase](t, "activity-files") {
		t.Run(c.File, func(t *testing.T) {
			got := golden.OrNull(parser.Parse(c.File, golden.ReadFile(t, "testdata/activity/"+c.File)))
			if ok, gotJSON := golden.Equal(t, got, c.Want); !ok {
				t.Errorf("got %s, want %s", gotJSON, c.Want)
			}
		})
	}
}

func TestParseByExtension(t *testing.T) {
	data := golden.ReadFile(t, "testdata/activity/run-5k.fit")
	parser := New(nil)
	if _, ok := parser.Parse("RUN.FIT", data); !ok {
		t.Error("upper-case extension not recognized")
	}
	if _, ok := parser.Parse("run.tcx", data); ok {
		t.Error("unknown extension parsed")
	}
	if _, ok := parser.Parse("run.gpx", data); ok {
		t.Error("FIT bytes parsed as GPX")
	}
}

func TestGPXQuirks(t *testing.T) {
	now := time.Date(2026, 9, 24, 0, 0, 0, 0, time.UTC)
	doc := func(points string) []byte {
		return []byte(`<gpx><trk><trkseg>` + points + `</trkseg></trk></gpx>`)
	}
	// Two points ~1.1 km apart, 6 minutes: HR one level under <extensions> only.
	pts := `<trkpt lat="52.37" lon="4.89"><time>2026-09-19T06:00:00Z</time><extensions><x><Hr>150</Hr></x></extensions></trkpt>` +
		`<trkpt lat="52.38" lon="4.89"><time>2026-09-19T06:06:00Z</time><extensions><hr>170</hr></extensions></trkpt>`
	s, ok := ParseGPX(doc(pts), now)
	if !ok || s.AvgHR == nil || *s.AvgHR != 150 || s.DistanceKm != 1.11 || s.DurationMin != 6 {
		t.Fatalf("summary = %+v, %v", s, ok)
	}
}
