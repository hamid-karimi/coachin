// Package workout is per-set strength logging math (FORMULAS.md §12):
// parsing plan prescriptions, normalizing logged sets, and total volume.
// Volume is a stat and a celebration, never an XP input.
package workout

import (
	"regexp"
	"slices"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

const (
	maxExercises       = 20
	maxSetsPerExercise = 10
	maxNameLength      = 80
)

// Set is one logged set.
type Set struct {
	WeightKg float64 `json:"weight_kg"`
	Reps     int     `json:"reps"`
}

// Exercise is one logged exercise with its sets.
type Exercise struct {
	Name string `json:"name"`
	Sets []Set  `json:"sets"`
}

// TotalVolumeKg is Σ weight × reps, to one decimal; non-positive values
// count as 0.
func TotalVolumeKg(exercises []Exercise) float64 {
	var total float64
	for _, exercise := range exercises {
		for _, set := range exercise.Sets {
			total += max(set.WeightKg, 0) * float64(max(set.Reps, 0))
		}
	}
	return round1(total)
}

// Equivalence is a fun real-world comparison for a lifted total.
type Equivalence struct {
	Label string `json:"label"`
	Emoji string `json:"emoji"`
}

// equivalences are checked heaviest first; the first one cleared wins.
var equivalences = []struct {
	minKg float64
	Equivalence
}{
	{4000, Equivalence{"an adult elephant", "🐘"}},
	{1500, Equivalence{"a small car", "🚗"}},
	{700, Equivalence{"a grand piano", "🎹"}},
	{400, Equivalence{"a horse", "🐎"}},
	{180, Equivalence{"a refrigerator", "🧊"}},
	{80, Equivalence{"a washing machine", "🧺"}},
}

// VolumeEquivalence compares kg to something as heavy; ok is false below the
// lightest comparison.
func VolumeEquivalence(kg float64) (Equivalence, bool) {
	for _, e := range equivalences {
		if kg >= e.minKg {
			return e.Equivalence, true
		}
	}
	return Equivalence{}, false
}

// Parsed is one exercise read from a plan prescription.
type Parsed struct {
	Name     string `json:"name"`
	Sets     int    `json:"sets"`
	RepsLow  int    `json:"repsLow"`
	RepsHigh *int   `json:"repsHigh"`
}

// jsSpace is JavaScript's \s (Go's \s is ASCII-only).
const jsSpace = `[\t\n\v\f\r \x{00a0}\x{1680}\x{2000}-\x{200a}\x{2028}\x{2029}\x{202f}\x{205f}\x{3000}\x{feff}]`

var (
	segmentSplit  = regexp.MustCompile(jsSpace + `\+` + jsSpace + `|\r?\n`)
	setRepPattern = regexp.MustCompile(`(?i)([0-9]+)` + jsSpace + `*[x×]` + jsSpace + `*([0-9]+)(?:` + jsSpace + `*[-–]` + jsSpace + `*([0-9]+))?`)
	trailingJunk  = regexp.MustCompile(`(?:` + jsSpace + `|[:·,–-])+$`)
)

// ParsePrescription reads a plan prescription such as
// "DB Goblet Squat 3x10-12 + DB Floor Press 3x10-12" (also one per line) into
// prefillable exercises. Segments without an NxM pattern or a name are skipped.
func ParsePrescription(text string) []Parsed {
	exercises := []Parsed{}
	for _, segment := range segmentSplit.Split(text, -1) {
		segment = jsnum.Trim(segment)
		if segment == "" {
			continue
		}
		if len(exercises) >= maxExercises {
			break
		}
		match := setRepPattern.FindStringSubmatchIndex(segment)
		if match == nil {
			continue
		}
		name := jsnum.Slice(jsnum.Trim(trailingJunk.ReplaceAllString(segment[:match[0]], "")), maxNameLength)
		if name == "" {
			continue
		}
		group := func(i int) string { return segment[match[2*i]:match[2*i+1]] }

		sets := int(min(jsnum.ToNumber(group(1)), maxSetsPerExercise))
		repsLow := jsnum.ToNumber(group(2))
		if sets < 1 || repsLow < 1 || repsLow > 99 {
			continue
		}
		var repsHigh *int
		if match[6] >= 0 {
			high := int(jsnum.ToNumber(group(3)))
			repsHigh = &high
		}
		exercises = append(exercises, Parsed{Name: name, Sets: sets, RepsLow: int(repsLow), RepsHigh: repsHigh})
	}
	return exercises
}

// NormalizeLoggedExercises reads a session log's actual.exercises (decoded
// JSON of either payload generation) into the per-set shape:
//   - current: {name, sets: [{weight_kg, reps}]}
//   - legacy:  {name, sets: 3, reps: 10, weight_kg?: 20} → 3 identical sets
//
// Invalid entries and sets are dropped; foreign data never errors.
func NormalizeLoggedExercises(raw any) []Exercise {
	entries, ok := raw.([]any)
	if !ok {
		return []Exercise{}
	}
	exercises := []Exercise{}
	for _, entry := range entries[:min(len(entries), maxExercises)] {
		if _, isObject := entry.(map[string]any); !isObject {
			continue
		}
		name := jsField(entry, "name")
		if name == nil {
			name = ""
		}
		trimmed := jsnum.Slice(jsnum.Trim(jsnum.ToString(name)), maxNameLength)
		if trimmed == "" {
			continue
		}

		var sets []Set
		if list, isList := jsnum.Field(entry, "sets").([]any); isList {
			sets = normalizeSets(list)
		} else {
			sets = expandLegacyRow(entry)
		}
		if len(sets) == 0 {
			continue
		}
		exercises = append(exercises, Exercise{Name: trimmed, Sets: sets})
	}
	return exercises
}

// jsField is `item.key ?? fallback`-ready: nil for a missing or null key.
func jsField(v any, key string) any {
	value := jsnum.Field(v, key)
	if _, missing := value.(jsnum.Missing); missing {
		return nil
	}
	return value
}

func normalizeSets(raw []any) []Set {
	sets := []Set{}
	for _, entry := range raw[:min(len(raw), maxSetsPerExercise)] {
		if !isJSObject(entry) {
			continue
		}
		reps, ok := validReps(jsnum.ToNumber(jsnum.Field(entry, "reps")))
		if !ok {
			continue
		}
		sets = append(sets, Set{WeightKg: validWeight(jsnum.Field(entry, "weight_kg")), Reps: reps})
	}
	return sets
}

func expandLegacyRow(item any) []Set {
	count := jsnum.ToNumber(jsnum.Field(item, "sets"))
	if !jsnum.IsInteger(count) || count < 1 {
		return nil
	}
	reps, ok := validReps(jsnum.ToNumber(jsnum.Field(item, "reps")))
	if !ok {
		return nil
	}
	set := Set{WeightKg: validWeight(jsnum.Field(item, "weight_kg")), Reps: reps}
	return slices.Repeat([]Set{set}, int(min(count, maxSetsPerExercise)))
}

// isJSObject is JavaScript's `typeof v === "object" && v !== null`, which is
// also true for arrays.
func isJSObject(v any) bool {
	switch v.(type) {
	case map[string]any, []any:
		return true
	}
	return false
}

func validReps(n float64) (int, bool) {
	if !jsnum.IsInteger(n) || n < 1 || n > 99 {
		return 0, false
	}
	return int(n), true
}

func validWeight(v any) float64 {
	w := jsnum.ToNumber(v)
	if !jsnum.IsFinite(w) || w <= 0 {
		return 0
	}
	return round1(w)
}

func round1(x float64) float64 { return jsnum.Round(x*10) / 10 }
