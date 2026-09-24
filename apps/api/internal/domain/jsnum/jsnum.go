// Package jsnum reproduces the JavaScript number semantics the legacy
// formulas relied on, so ported math returns identical values.
package jsnum

import (
	"math"
	"strconv"
	"strings"
)

// Round is JavaScript's Math.round: halves round toward +Inf (-2.5 → -2),
// unlike Go's math.Round, which rounds them away from zero (-2.5 → -3).
func Round(x float64) float64 {
	return math.Floor(x + 0.5)
}

// Number is JavaScript's Number(string) for decimal input: surrounding
// whitespace is ignored and the empty string is 0. ok is false where
// JavaScript would produce NaN.
func Number(s string) (value float64, ok bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, true
	}
	lower := strings.ToLower(s)
	if strings.HasPrefix(lower, "0x") || strings.HasPrefix(lower, "0o") || strings.HasPrefix(lower, "0b") {
		n, err := strconv.ParseInt(s, 0, 64)
		return float64(n), err == nil
	}
	if strings.ContainsAny(lower, "_") || strings.Contains(lower, "inf") || strings.Contains(lower, "nan") {
		return 0, false
	}
	f, err := strconv.ParseFloat(s, 64)
	return f, err == nil
}
