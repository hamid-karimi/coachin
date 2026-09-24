package jsnum

import (
	"math"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf16"
)

// Missing marks an absent object key (JavaScript's undefined), as opposed to
// an explicit JSON null.
type Missing struct{}

// Field reads key from a decoded JSON object, returning Missing{} when the key
// is absent or v is not an object.
func Field(v any, key string) any {
	obj, ok := v.(map[string]any)
	if !ok {
		return Missing{}
	}
	value, found := obj[key]
	if !found {
		return Missing{}
	}
	return value
}

// ToNumber is JavaScript's Number(v) for a decoded JSON value. NaN stands for
// "not a number", exactly as in JavaScript.
func ToNumber(v any) float64 {
	switch x := v.(type) {
	case nil:
		return 0
	case Missing:
		return math.NaN()
	case float64:
		return x
	case bool:
		if x {
			return 1
		}
		return 0
	case string:
		if n, ok := Number(x); ok {
			return n
		}
		return math.NaN()
	case []any:
		// Number([]) is 0, Number([7]) is 7, Number([1, 2]) is NaN.
		return ToNumber(ToString(x))
	}
	return math.NaN() // objects
}

// ToString is JavaScript's String(v) for a decoded JSON value.
func ToString(v any) string {
	switch x := v.(type) {
	case nil:
		return "null"
	case Missing:
		return "undefined"
	case string:
		return x
	case bool:
		return strconv.FormatBool(x)
	case float64:
		return FormatNumber(x)
	case []any:
		parts := make([]string, len(x))
		for i, item := range x {
			if item != nil { // null and undefined join as empty strings
				parts[i] = ToString(item)
			}
		}
		return strings.Join(parts, ",")
	}
	return "[object Object]"
}

// FormatNumber is JavaScript's number-to-string for ordinary magnitudes
// (1e-6 ≤ |x| < 1e21): 50 → "50", 33.3 → "33.3".
func FormatNumber(x float64) string {
	if math.IsNaN(x) {
		return "NaN"
	}
	if math.IsInf(x, 0) {
		if x > 0 {
			return "Infinity"
		}
		return "-Infinity"
	}
	return strconv.FormatFloat(x, 'f', -1, 64)
}

// IsInteger is JavaScript's Number.isInteger.
func IsInteger(x float64) bool {
	return !math.IsNaN(x) && !math.IsInf(x, 0) && x == math.Trunc(x)
}

// IsFinite is JavaScript's Number.isFinite for a number.
func IsFinite(x float64) bool { return !math.IsNaN(x) && !math.IsInf(x, 0) }

// Trim is JavaScript's String.prototype.trim (Unicode spaces and the BOM).
func Trim(s string) string {
	return strings.TrimFunc(s, func(r rune) bool { return unicode.IsSpace(r) || r == '\uFEFF' })
}

// Slice is JavaScript's s.slice(0, n): the first n UTF-16 code units.
func Slice(s string, n int) string {
	units := utf16.Encode([]rune(s))
	if len(units) <= n {
		return s
	}
	return string(utf16.Decode(units[:n]))
}

// FormatEnUS is x.toLocaleString("en-US"): thousands separated by commas, at
// most three fraction digits (rounded half away from zero), no trailing zeros.
func FormatEnUS(x float64) string {
	if math.IsNaN(x) || math.IsInf(x, 0) {
		return FormatNumber(x)
	}
	sign := ""
	if x < 0 {
		sign, x = "-", -x
	}
	fixed := strconv.FormatFloat(Round(x*1000)/1000, 'f', 3, 64)
	whole, fraction, _ := strings.Cut(fixed, ".")
	fraction = strings.TrimRight(fraction, "0")
	var b strings.Builder
	for i, digit := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(digit)
	}
	if fraction != "" {
		b.WriteString("." + fraction)
	}
	if b.String() == "0" && fraction == "" {
		sign = ""
	}
	return sign + b.String()
}
