package training

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
)

type fakePrograms struct {
	rows     []ProgramRow
	reviewed map[uuid.UUID]map[int]bool
	items    []ExportItem
}

func (f *fakePrograms) ActivePrograms(context.Context, uuid.UUID) ([]ProgramRow, error) {
	return f.rows, nil
}
func (f *fakePrograms) ReviewedWeeks(context.Context, uuid.UUID, []uuid.UUID) (map[uuid.UUID]map[int]bool, error) {
	return f.reviewed, nil
}
func (f *fakePrograms) ArchivePlan(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (f *fakePrograms) ActivePlanItems(context.Context, uuid.UUID) ([]ExportItem, error) {
	return f.items, nil
}

// Thursday 2026-09-24.
var thursday = func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) }

func TestProgramsList(t *testing.T) {
	user, coach := uuid.New(), uuid.New()
	race, lift, fresh := uuid.New(), uuid.New(), uuid.New()
	raceDate := "2026-10-04"
	store := &fakePrograms{
		rows: []ProgramRow{
			// Started Monday 2026-09-07 → week 3; week 2 elapsed and was reviewed.
			{ID: race, CreatedAt: time.Date(2026, 9, 7, 8, 0, 0, 0, time.UTC), WeeksTotal: 8, RaceDate: &raceDate, CreatedBy: &user},
			// Started 2026-09-14 → week 2; week 1 elapsed, not reviewed.
			{ID: lift, CreatedAt: time.Date(2026, 9, 14, 8, 0, 0, 0, time.UTC), WeeksTotal: 8, CreatedBy: &coach},
			// Started this week → nothing to review.
			{ID: fresh, CreatedAt: time.Date(2026, 9, 21, 8, 0, 0, 0, time.UTC), WeeksTotal: 8},
		},
		reviewed: map[uuid.UUID]map[int]bool{race: {2: true}},
	}
	programs, err := NewPrograms(store, thursday).List(context.Background(), user)
	if err != nil {
		t.Fatal(err)
	}
	r, l, f := programs[0], programs[1], programs[2]
	if r.CurrentWeek != 3 || r.ReviewWeek != 2 || r.CheckinDue || r.FromCoach || r.DaysUntilRace == nil || *r.DaysUntilRace != 10 {
		t.Errorf("race = %+v", r)
	}
	if l.CurrentWeek != 2 || l.ReviewWeek != 1 || !l.CheckinDue || !l.FromCoach || l.DaysUntilRace != nil {
		t.Errorf("lift = %+v", l)
	}
	if f.ReviewWeek != 0 || f.CheckinDue {
		t.Errorf("fresh = %+v", f)
	}
}

func TestCalendarExport(t *testing.T) {
	km, notes := 8.0, "Easy"
	created := time.Date(2026, 9, 7, 8, 0, 0, 0, time.UTC)
	store := &fakePrograms{
		rows: []ProgramRow{{ID: uuid.New(), CreatedAt: created, WeeksTotal: 8}},
		items: []ExportItem{
			{ID: uuid.New(), Week: 1, DayOfWeek: 2, ItemType: "run", Title: "Tempo, steady", PlanCreatedAt: created,
				Details: planitem.Details{DistanceKm: &km, Notes: &notes}},
			{ID: uuid.New(), Week: 1, DayOfWeek: 3, ItemType: "meal_note", Title: "Carbs", PlanCreatedAt: created},
		},
	}
	calendar, err := NewPrograms(store, thursday).CalendarExport(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"DTSTART;VALUE=DATE:20260908", `SUMMARY:Tempo\, steady`, `DESCRIPTION:8km\nEasy`} {
		if !strings.Contains(calendar, want) {
			t.Errorf("missing %q in\n%s", want, calendar)
		}
	}
	if strings.Contains(calendar, "Carbs") {
		t.Error("meal notes must not be exported")
	}

	_, err = NewPrograms(&fakePrograms{}, thursday).CalendarExport(context.Background(), uuid.New())
	if kindOf(err) != apperr.NotFound {
		t.Errorf("no plan: %v", err)
	}
}
