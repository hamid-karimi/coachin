package jsnum

import (
	"math"
	"testing"
)

func TestToNumberMatchesJavaScript(t *testing.T) {
	cases := []struct {
		in   any
		want float64
	}{
		{nil, 0}, {true, 1}, {false, 0}, {"12", 12}, {" ", 0}, {3.5, 3.5},
		{[]any{}, 0}, {[]any{7.0}, 7}, {[]any{"8"}, 8},
	}
	for _, c := range cases {
		if got := ToNumber(c.in); got != c.want {
			t.Errorf("ToNumber(%#v) = %v, want %v", c.in, got, c.want)
		}
	}
	for _, in := range []any{Missing{}, "abc", map[string]any{}, []any{1.0, 2.0}} {
		if got := ToNumber(in); !math.IsNaN(got) {
			t.Errorf("ToNumber(%#v) = %v, want NaN", in, got)
		}
	}
}

func TestToStringMatchesJavaScript(t *testing.T) {
	cases := []struct {
		in   any
		want string
	}{
		{nil, "null"}, {Missing{}, "undefined"}, {"x", "x"}, {12.0, "12"}, {33.3, "33.3"},
		{true, "true"}, {[]any{1.0, nil, "a"}, "1,,a"}, {map[string]any{}, "[object Object]"},
	}
	for _, c := range cases {
		if got := ToString(c.in); got != c.want {
			t.Errorf("ToString(%#v) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestSliceCountsUTF16Units(t *testing.T) {
	if got := Slice("héllo", 2); got != "hé" {
		t.Errorf("got %q", got)
	}
	if got := Slice("💪ab", 3); got != "💪a" { // the emoji is 2 UTF-16 units
		t.Errorf("got %q", got)
	}
	if got := Trim("\uFEFF  hi  "); got != "hi" {
		t.Errorf("got %q", got)
	}
}
