package aigen

import (
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// ItemDetails are the optional numbers and notes of a generated item.
type ItemDetails struct {
	DistanceKm  *float64 `json:"distance_km,omitempty"`
	PaceMinKm   *string  `json:"pace_min_km,omitempty"`
	DurationMin *float64 `json:"duration_min,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
	VideoQuery  *string  `json:"video_query,omitempty"`
}

// PlanItemInput is one validated generated plan item (the create_training_plan
// payload shape).
type PlanItemInput struct {
	Week        int         `json:"week"`
	DayOfWeek   int         `json:"day_of_week"`
	ItemType    string      `json:"item_type"`
	Title       string      `json:"title"`
	Description *string     `json:"description,omitempty"`
	Details     ItemDetails `json:"details"`
}

const maxItems = 400

var itemTypes = map[string]bool{"run": true, "strength": true, "stretch": true, "mobility": true, "recovery": true, "meal_note": true}

// ValidateItems keeps the well-formed items of decoded AI output (never trust
// its shape): week 1–24, weekday 0–6, a known type, a non-blank title; text is
// trimmed and capped, numbers rounded. At most 400 entries are read.
func ValidateItems(raw any) []PlanItemInput {
	entries, ok := raw.([]any)
	if !ok {
		return []PlanItemInput{}
	}
	if len(entries) > maxItems {
		entries = entries[:maxItems]
	}
	items := []PlanItemInput{}
	for _, entry := range entries {
		if !isObject(entry) {
			continue
		}
		week := jsnum.ToNumber(jsnum.Field(entry, "week"))
		day := jsnum.ToNumber(jsnum.Field(entry, "day_of_week"))
		itemType := orEmpty(jsnum.Field(entry, "item_type"))
		title := jsnum.Trim(orEmpty(jsnum.Field(entry, "title")))
		if !jsnum.IsInteger(week) || week < 1 || week > 24 {
			continue
		}
		if !jsnum.IsInteger(day) || day < 0 || day > 6 {
			continue
		}
		if !itemTypes[itemType] || title == "" {
			continue
		}
		item := PlanItemInput{Week: int(week), DayOfWeek: int(day), ItemType: itemType, Title: jsnum.Slice(title, 200)}
		if d, ok := jsnum.Field(entry, "description").(string); ok {
			if d = jsnum.Trim(d); d != "" {
				d = jsnum.Slice(d, 2000)
				item.Description = &d
			}
		}
		details := jsnum.Field(entry, "details")
		if n, ok := jsnum.Field(details, "distance_km").(float64); ok {
			v := jsnum.Round(n*10) / 10
			item.Details.DistanceKm = &v
		}
		if s, ok := jsnum.Field(details, "pace_min_km").(string); ok {
			s = jsnum.Slice(s, 20)
			item.Details.PaceMinKm = &s
		}
		if n, ok := jsnum.Field(details, "duration_min").(float64); ok {
			v := jsnum.Round(n)
			item.Details.DurationMin = &v
		}
		if s, ok := jsnum.Field(details, "notes").(string); ok {
			s = jsnum.Slice(s, 500)
			item.Details.Notes = &s
		}
		if s, ok := jsnum.Field(details, "video_query").(string); ok && jsnum.Trim(s) != "" {
			s = jsnum.Slice(jsnum.Trim(s), 80)
			item.Details.VideoQuery = &s
		}
		items = append(items, item)
	}
	return items
}

// isObject is typeof v === "object" && v !== null (arrays included).
func isObject(v any) bool {
	switch v.(type) {
	case map[string]any, []any:
		return true
	}
	return false
}

// orEmpty is String(v ?? "").
func orEmpty(v any) string {
	switch v.(type) {
	case nil, jsnum.Missing:
		return ""
	}
	return jsnum.ToString(v)
}
