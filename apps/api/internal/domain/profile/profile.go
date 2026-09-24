// Package profile holds pure profile and onboarding rules: routine schedule
// rows and the country used to localize nutrition prompts.
package profile

import (
	"regexp"
	"slices"
	"strings"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
)

// ScheduleRow is one weekly routine session to insert.
type ScheduleRow struct {
	UserID      string  `json:"user_id"`
	SportTypeID int64   `json:"sport_type_id"`
	DayOfWeek   int     `json:"day_of_week"`
	Time        *string `json:"time"`
	EndsOn      *string `json:"ends_on"`
}

// ScheduleRequest is one sport picked for several weekdays (0=Sun … 6=Sat).
type ScheduleRequest struct {
	UserID      string    `json:"userId"`
	SportTypeID int64     `json:"sportTypeId"`
	Days        []float64 `json:"days"`
	Time        *string   `json:"time"`
	EndsOn      *string   `json:"endsOn"`
}

func blankToNil(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := jsnum.Trim(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// ScheduleRows fans one sport out across its weekdays: duplicates and
// out-of-range days are dropped, blank time/end dates become nil.
func ScheduleRows(req ScheduleRequest) []ScheduleRow {
	rows := []ScheduleRow{}
	var seen []float64
	for _, day := range req.Days {
		if slices.Contains(seen, day) {
			continue
		}
		seen = append(seen, day)
		if !jsnum.IsInteger(day) || day < 0 || day > 6 {
			continue
		}
		rows = append(rows, ScheduleRow{
			UserID: req.UserID, SportTypeID: req.SportTypeID, DayOfWeek: int(day),
			Time: blankToNil(req.Time), EndsOn: blankToNil(req.EndsOn),
		})
	}
	return rows
}

var twoLetters = regexp.MustCompile(`^[A-Z]{2}$`)

// CountryName is the English name for a two-letter region code, or ok=false
// for anything unknown.
func CountryName(code string) (name string, ok bool) {
	code = strings.ToUpper(jsnum.Trim(code))
	if !twoLetters.MatchString(code) {
		return "", false
	}
	name, ok = countryNames[code]
	return name, ok
}

// maxCountryLength bounds a user-typed profile country.
const maxCountryLength = 56

// ResolveCountry picks the country for nutrition prompts: the profile value
// wins; otherwise a geo-IP region code from the edge proxy, when there is one.
func ResolveCountry(profileCountry, regionCode *string) (country string, ok bool) {
	if profileCountry != nil {
		if fromProfile := jsnum.Slice(jsnum.Trim(*profileCountry), maxCountryLength); fromProfile != "" {
			return fromProfile, true
		}
	}
	if regionCode == nil {
		return "", false
	}
	return CountryName(*regionCode)
}
