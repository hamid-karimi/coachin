// Package planitem holds rules for AI training-plan items shared by the
// week, today, calendar, and training views.
package planitem

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// Details are the display fields of plan_items.details. The JSON comes from
// AI output, so every field is optional and parsed leniently.
type Details struct {
	DistanceKm  *float64 `json:"distance_km,omitempty"`
	PaceMinKm   *string  `json:"pace_min_km,omitempty"`
	DurationMin *float64 `json:"duration_min,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
	VideoQuery  *string  `json:"video_query,omitempty"`
}

// ParseDetails reads the known fields from raw details JSON. Numbers may be
// JSON numbers or numeric strings; blank strings, wrong types, and malformed
// JSON yield empty fields, never an error — one odd AI answer must not break
// a whole week view.
func ParseDetails(raw []byte) Details {
	var fields map[string]any
	if json.Unmarshal(raw, &fields) != nil {
		return Details{}
	}
	return Details{
		DistanceKm:  number(fields["distance_km"]),
		PaceMinKm:   text(fields["pace_min_km"]),
		DurationMin: number(fields["duration_min"]),
		Notes:       text(fields["notes"]),
		VideoQuery:  text(fields["video_query"]),
	}
}

func number(value any) *float64 {
	switch v := value.(type) {
	case float64:
		return &v
	case string:
		if n, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err == nil {
			return &n
		}
	}
	return nil
}

func text(value any) *string {
	if s, ok := value.(string); ok && strings.TrimSpace(s) != "" {
		return &s
	}
	return nil
}

// hardTypes are the sessions that count toward a "too intense" day.
var hardTypes = map[string]bool{"run": true, "strength": true}

// HasHardCollision reports 2+ hard sessions (run/strength) on one day — the
// signal for the soft "consider spacing them" warning when several active
// plans land on the same date.
func HasHardCollision(itemTypes []string) bool {
	hard := 0
	for _, t := range itemTypes {
		if hardTypes[t] {
			hard++
		}
	}
	return hard >= 2
}

// Checkable reports whether an item type has a done toggle (meal notes don't).
func Checkable(itemType string) bool { return itemType != "meal_note" }

// LogWindowOpen reports whether an item dated itemDate can be marked done
// today: on its day or the day after. Both are calendar dates (YYYY-MM-DD
// times at midnight in the same location). Undoing is always allowed and is
// not checked here.
func LogWindowOpen(itemDate, today time.Time) bool {
	return !today.Before(itemDate) && !today.After(itemDate.AddDate(0, 0, 1))
}

// DetailLine is the compact stat line, e.g. "6km · @ 7:45/km · 45min"
// (numbers formatted as JavaScript would, as the legacy app did).
func DetailLine(d Details) string {
	var parts []string
	if d.DistanceKm != nil && *d.DistanceKm != 0 {
		parts = append(parts, jsnum.FormatNumber(*d.DistanceKm)+"km")
	}
	if d.PaceMinKm != nil {
		parts = append(parts, "@ "+*d.PaceMinKm+"/km")
	}
	if d.DurationMin != nil && *d.DurationMin != 0 {
		parts = append(parts, jsnum.FormatNumber(*d.DurationMin)+"min")
	}
	return strings.Join(parts, " · ")
}

// VideoURL is the YouTube "how-to" search for the item, or "" when unset.
func VideoURL(d Details) string {
	if d.VideoQuery == nil {
		return ""
	}
	return "https://www.youtube.com/results?search_query=" + encodeURIComponent(*d.VideoQuery)
}

// encodeURIComponent escapes like JavaScript's function of the same name.
func encodeURIComponent(s string) string {
	const unreserved = "-_.!~*'()"
	var b strings.Builder
	for _, c := range []byte(s) {
		if ('a' <= c && c <= 'z') || ('A' <= c && c <= 'Z') || ('0' <= c && c <= '9') || strings.IndexByte(unreserved, c) >= 0 {
			b.WriteByte(c)
			continue
		}
		fmt.Fprintf(&b, "%%%02X", c)
	}
	return b.String()
}
