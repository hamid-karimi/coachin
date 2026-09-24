// Package ics writes RFC 5545 calendars of all-day events (the training-plan
// export importable into Apple, Google, and Outlook calendars).
package ics

import (
	"strings"
	"time"
)

// Event is one all-day event.
type Event struct {
	UID         string
	Date        time.Time // the day (its calendar date is used)
	Summary     string
	Description string // "" falls back to a generic line
}

var escaper = strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\r\n", `\n`, "\n", `\n`)

// Escape escapes a TEXT value (SUMMARY, DESCRIPTION).
func Escape(s string) string { return escaper.Replace(s) }

const compactDate = "20060102"

// Calendar renders the events with CRLF line endings; stamp is DTSTAMP's day.
func Calendar(events []Event, stamp time.Time) string {
	lines := []string{"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CoachIn//Training Plan//EN", "CALSCALE:GREGORIAN"}
	dtstamp := stamp.Format(compactDate) + "T000000Z"
	for _, e := range events {
		description := "CoachIn training"
		if e.Description != "" {
			description = Escape(e.Description)
		}
		lines = append(lines,
			"BEGIN:VEVENT",
			"UID:"+e.UID,
			"DTSTAMP:"+dtstamp,
			"DTSTART;VALUE=DATE:"+e.Date.Format(compactDate),
			"DTEND;VALUE=DATE:"+e.Date.AddDate(0, 0, 1).Format(compactDate),
			"SUMMARY:"+Escape(e.Summary),
			"DESCRIPTION:"+description,
			"END:VEVENT",
		)
	}
	lines = append(lines, "END:VCALENDAR")
	return strings.Join(lines, "\r\n")
}
