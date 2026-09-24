package ics

import (
	"strings"
	"testing"
	"time"
)

func TestEscape(t *testing.T) {
	if got := Escape("a,b;c\\d\nnext\r\nlast"); got != `a\,b\;c\\d\nnext\nlast` {
		t.Errorf("Escape = %q", got)
	}
}

func TestCalendar(t *testing.T) {
	day := time.Date(2026, 12, 31, 0, 0, 0, 0, time.UTC)
	got := Calendar([]Event{
		{UID: "1@coachin", Date: day, Summary: "Tempo, easy", Description: "8km\nWarm up"},
		{UID: "2@coachin", Date: day, Summary: "Rest"},
	}, time.Date(2026, 9, 24, 15, 0, 0, 0, time.UTC))
	want := strings.Join([]string{
		"BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CoachIn//Training Plan//EN", "CALSCALE:GREGORIAN",
		"BEGIN:VEVENT", "UID:1@coachin", "DTSTAMP:20260924T000000Z", "DTSTART;VALUE=DATE:20261231",
		"DTEND;VALUE=DATE:20270101", `SUMMARY:Tempo\, easy`, `DESCRIPTION:8km\nWarm up`, "END:VEVENT",
		"BEGIN:VEVENT", "UID:2@coachin", "DTSTAMP:20260924T000000Z", "DTSTART;VALUE=DATE:20261231",
		"DTEND;VALUE=DATE:20270101", "SUMMARY:Rest", "DESCRIPTION:CoachIn training", "END:VEVENT",
		"END:VCALENDAR",
	}, "\r\n")
	if got != want {
		t.Errorf("Calendar =\n%s\nwant\n%s", got, want)
	}
}
