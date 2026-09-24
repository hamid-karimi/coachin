package planitem

import (
	"reflect"
	"testing"
	"time"
)

func f(v float64) *float64 { return &v }
func s(v string) *string   { return &v }

func TestParseDetails(t *testing.T) {
	cases := map[string]struct {
		raw  string
		want Details
	}{
		"full": {
			`{"distance_km":6,"pace_min_km":"7:45","duration_min":45,"notes":"Easy","video_query":"strides"}`,
			Details{DistanceKm: f(6), PaceMinKm: s("7:45"), DurationMin: f(45), Notes: s("Easy"), VideoQuery: s("strides")},
		},
		"numeric strings": {`{"distance_km":" 5.5 ","duration_min":"30"}`, Details{DistanceKm: f(5.5), DurationMin: f(30)}},
		"wrong types":     {`{"distance_km":"far","pace_min_km":7,"notes":["x"]}`, Details{}},
		"blank strings":   {`{"notes":"  ","video_query":""}`, Details{}},
		"unknown fields":  {`{"sets":3,"reps":10}`, Details{}},
		"empty object":    {`{}`, Details{}},
		"not an object":   {`[1,2]`, Details{}},
		"malformed":       {`{`, Details{}},
		"null":            {`null`, Details{}},
	}
	for name, tc := range cases {
		if got := ParseDetails([]byte(tc.raw)); !reflect.DeepEqual(got, tc.want) {
			t.Errorf("%s: got %+v, want %+v", name, got, tc.want)
		}
	}
}

func TestHasHardCollision(t *testing.T) {
	cases := map[bool][][]string{
		true:  {{"run", "strength"}, {"run", "run"}, {"stretch", "strength", "run"}},
		false: {nil, {"run"}, {"run", "stretch", "mobility", "recovery", "meal_note"}},
	}
	for want, lists := range cases {
		for _, types := range lists {
			if got := HasHardCollision(types); got != want {
				t.Errorf("HasHardCollision(%v) = %v", types, got)
			}
		}
	}
}

func TestLogWindowOpen(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 9, d, 0, 0, 0, 0, time.UTC) }
	item := day(22)
	for today, want := range map[int]bool{21: false, 22: true, 23: true, 24: false} {
		if got := LogWindowOpen(item, day(today)); got != want {
			t.Errorf("item 22, today %d: %v, want %v", today, got, want)
		}
	}
}

func TestDetailLineAndVideo(t *testing.T) {
	full := Details{DistanceKm: f(6.5), PaceMinKm: s("7:45"), DurationMin: f(45), VideoQuery: s("cat cow stretch & more")}
	if got := DetailLine(full); got != "6.5km · @ 7:45/km · 45min" {
		t.Errorf("DetailLine = %q", got)
	}
	if got := DetailLine(Details{DurationMin: f(30)}); got != "30min" {
		t.Errorf("DetailLine = %q", got)
	}
	if got := DetailLine(Details{DistanceKm: f(0)}); got != "" {
		t.Errorf("zero distance: %q", got)
	}
	if got := VideoURL(full); got != "https://www.youtube.com/results?search_query=cat%20cow%20stretch%20%26%20more" {
		t.Errorf("VideoURL = %q", got)
	}
	if VideoURL(Details{}) != "" {
		t.Error("no query should give no URL")
	}
}
