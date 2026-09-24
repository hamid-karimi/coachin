package jsnum

import "testing"

func TestRoundMatchesJavaScript(t *testing.T) {
	cases := map[float64]float64{2.5: 3, -2.5: -2, 0.49: 0, -0.5: -0, 59.5: 60, -30.2: -30}
	for in, want := range cases {
		if got := Round(in); got != want {
			t.Errorf("Round(%v) = %v, want %v", in, got, want)
		}
	}
}

func TestNumberMatchesJavaScript(t *testing.T) {
	cases := []struct {
		in   string
		want float64
		ok   bool
	}{
		{"", 0, true}, {"  ", 0, true}, {" 25 ", 25, true}, {"1.5", 1.5, true},
		{"0x10", 16, true}, {"1e3", 1000, true}, {"-1", -1, true},
		{"abc", 0, false}, {"1_000", 0, false}, {"Infinity", 0, false}, {"NaN", 0, false},
	}
	for _, c := range cases {
		got, ok := Number(c.in)
		if ok != c.ok || (ok && got != c.want) {
			t.Errorf("Number(%q) = %v, %v; want %v, %v", c.in, got, ok, c.want, c.ok)
		}
	}
}
