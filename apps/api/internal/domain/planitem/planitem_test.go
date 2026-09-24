package planitem

import (
	"reflect"
	"testing"
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
