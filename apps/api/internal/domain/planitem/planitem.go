// Package planitem holds rules for AI training-plan items shared by the
// week, today, calendar, and training views.
package planitem

import (
	"encoding/json"
	"strconv"
	"strings"
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
