package streak

import (
	"time"

	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
)

// Schedule is a routine session's weekday (0=Sun…6=Sat) and optional active
// window (YYYY-MM-DD; "" is open-ended).
type Schedule struct {
	DayOfWeek        int
	StartsOn, EndsOn string
}

// Slot is a plan (week, weekday) holding a non-meal item.
type Slot struct{ Week, DayOfWeek int }

// Plan is an active plan: its start, length, and scheduled slots.
type Plan struct {
	CreatedAt  time.Time
	WeeksTotal int
	Slots      map[Slot]bool
}

// History is what settling a range of days reads.
type History struct {
	Trained   map[string]bool // dates with a completed log, of any discipline
	Schedules []Schedule
	Plans     []Plan
}

// Required reports a training day: a routine session scheduled that weekday
// (within its window) or a non-meal item on that date in any active plan — each
// plan's week counted from its own start.
func (h History) Required(day time.Time) bool {
	ymd, weekday := dates.ToYMD(day), int(day.Weekday())
	for _, s := range h.Schedules {
		if s.DayOfWeek == weekday && (s.StartsOn == "" || s.StartsOn <= ymd) && (s.EndsOn == "" || s.EndsOn >= ymd) {
			return true
		}
	}
	for _, p := range h.Plans {
		week := dates.PlanWeekForDate(p.CreatedAt, day)
		if week >= 1 && week <= p.WeeksTotal && p.Slots[Slot{Week: week, DayOfWeek: weekday}] {
			return true
		}
	}
	return false
}

// Window is the range of days to settle, from the day after the last settled
// one (a first run settles only yesterday — no retroactive punishment) through
// yesterday; ok is false when there's nothing to settle. Days are midnights in
// today's location.
func Window(settledThrough *time.Time, today time.Time) (from, to time.Time, ok bool) {
	to = today.AddDate(0, 0, -1)
	from = to
	if settledThrough != nil {
		from = settledThrough.AddDate(0, 0, 1)
	}
	return from, to, !from.After(to)
}

// SettleRange applies each day from..to (inclusive) with Next.
func SettleRange(state State, from, to time.Time, h History) State {
	for day := from; !day.After(to); day = day.AddDate(0, 0, 1) {
		state = Next(state, Day{Trained: h.Trained[dates.ToYMD(day)], RequiredDay: h.Required(day)})
	}
	return state
}
