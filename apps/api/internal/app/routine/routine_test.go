package routine

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
)

type fakeStore struct {
	sports    map[int64]bool
	schedules []Schedule
	quotas    []Quota
	logs      []quotas.Log
	plan      *Plan
	items     map[int][]PlanItem

	added     []profile.ScheduleRow
	saved     [2]int64
	logWindow [2]string
}

func (f *fakeStore) SportTypes(context.Context) ([]SportType, error) { return nil, nil }
func (f *fakeStore) SportTypeExists(_ context.Context, id int64) (bool, error) {
	return f.sports[id], nil
}
func (f *fakeStore) Schedules(context.Context, uuid.UUID) ([]Schedule, error) {
	return f.schedules, nil
}
func (f *fakeStore) AddSchedules(_ context.Context, _ uuid.UUID, rows []profile.ScheduleRow) error {
	f.added = rows
	return nil
}
func (f *fakeStore) DeleteSchedule(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (f *fakeStore) Quotas(context.Context, uuid.UUID) ([]Quota, error)         { return f.quotas, nil }
func (f *fakeStore) SaveQuota(_ context.Context, _ uuid.UUID, sport int64, n int) error {
	f.saved = [2]int64{sport, int64(n)}
	return nil
}
func (f *fakeStore) DeleteQuota(context.Context, uuid.UUID, int64) error { return nil }
func (f *fakeStore) Logs(_ context.Context, _ uuid.UUID, from, to string) ([]quotas.Log, error) {
	f.logWindow = [2]string{from, to}
	return f.logs, nil
}
func (f *fakeStore) LatestActivePlan(context.Context, uuid.UUID) (*Plan, error) { return f.plan, nil }
func (f *fakeStore) PlanWeekItems(_ context.Context, _, _ uuid.UUID, week int) ([]PlanItem, error) {
	return f.items[week], nil
}

// Wednesday 2026-09-23, 10:00 UTC.
var wednesday = time.Date(2026, 9, 23, 10, 0, 0, 0, time.UTC)

func newService(store *fakeStore) *Service {
	return NewService(store, func() time.Time { return wednesday })
}

func ptr[T any](v T) *T { return &v }

func wantInvalid(t *testing.T, err error, msg string) {
	t.Helper()
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Kind != apperr.Invalid || appErr.Message != msg {
		t.Fatalf("err = %v, want invalid %q", err, msg)
	}
}

func TestWeek(t *testing.T) {
	running, gym := int64(1), int64(2)
	store := &fakeStore{
		schedules: []Schedule{
			{DayOfWeek: 1, SportTypeID: &running, XPMultiplier: ptr(1.2)},
			{DayOfWeek: 3, SportTypeID: &running, XPMultiplier: ptr(1.2)},
			{DayOfWeek: 5, SportTypeID: &gym}, // unset multiplier counts as 1
		},
		quotas: []Quota{{SportTypeID: running, SessionsPerWeek: 3}, {SportTypeID: gym, SessionsPerWeek: 1}},
		logs: []quotas.Log{
			{SportTypeID: &running, Date: "2026-09-21", Status: "completed"},
			{SportTypeID: &running, Date: "2026-09-21", Status: "completed"}, // same day counts once
			{SportTypeID: &running, Date: "2026-09-22", Status: "completed"},
			{SportTypeID: &gym, Date: "2026-09-22", Status: "skipped"},
		},
		// Created on the Monday two weeks back → this is plan week 3.
		plan:  &Plan{CreatedAt: time.Date(2026, 9, 7, 8, 0, 0, 0, time.UTC), WeeksTotal: 8},
		items: map[int][]PlanItem{3: {{Title: "Tempo run"}}},
	}
	week, err := newService(store).Week(context.Background(), uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	if store.logWindow != [2]string{"2026-09-21", "2026-09-27"} {
		t.Errorf("log window = %v, want Mon–Sun of this week", store.logWindow)
	}
	if got := [2]int{week.Quotas[0].DoneThisWeek, week.Quotas[1].DoneThisWeek}; got != [2]int{2, 0} {
		t.Errorf("done = %v, want [2 0]", got)
	}
	if week.EstimatedWeeklyXP != 204 { // 72 + 72 + 60
		t.Errorf("estimate = %d, want 204", week.EstimatedWeeklyXP)
	}
	if len(week.PlanItems) != 1 || week.PlanItems[0].Title != "Tempo run" {
		t.Errorf("plan items = %+v", week.PlanItems)
	}
}

func TestWeekWithoutPlanHasNoItems(t *testing.T) {
	week, err := newService(&fakeStore{}).Week(context.Background(), uuid.New())
	if err != nil || week.PlanItems == nil || len(week.PlanItems) != 0 {
		t.Fatalf("items = %#v, err = %v", week.PlanItems, err)
	}
}

func TestAddSchedules(t *testing.T) {
	store := &fakeStore{sports: map[int64]bool{1: true}}
	svc := newService(store)
	ctx, user := context.Background(), uuid.New()

	n, err := svc.AddSchedules(ctx, user, AddSchedulesInput{SportTypeID: 1, Days: []int{1, 3, 3, 9}, Time: "07:30", EndsOn: " "})
	if err != nil || n != 2 {
		t.Fatalf("n = %d, err = %v", n, err)
	}
	if got := store.added; got[0].DayOfWeek != 1 || got[1].DayOfWeek != 3 || *got[0].Time != "07:30" || got[0].EndsOn != nil {
		t.Errorf("rows = %+v", got)
	}

	cases := map[string]AddSchedulesInput{
		"Please fill in all required fields.":           {SportTypeID: 1},
		"Please pick at least one day.":                 {SportTypeID: 1, Days: []int{7, -1}},
		"Enter a valid time.":                           {SportTypeID: 1, Days: []int{1}, Time: "25:00"},
		"Enter a valid 'repeat until' date.":            {SportTypeID: 1, Days: []int{1}, EndsOn: "2026-02-30"},
		"Unknown sport. Please pick one from the list.": {SportTypeID: 99, Days: []int{1}},
	}
	for msg, in := range cases {
		_, err := svc.AddSchedules(ctx, user, in)
		wantInvalid(t, err, msg)
	}
}

func TestSaveQuota(t *testing.T) {
	store := &fakeStore{sports: map[int64]bool{1: true}}
	svc := newService(store)
	ctx, user := context.Background(), uuid.New()

	if err := svc.SaveQuota(ctx, user, 1, 14); err != nil || store.saved != [2]int64{1, 14} {
		t.Fatalf("saved = %v, err = %v", store.saved, err)
	}
	wantInvalid(t, svc.SaveQuota(ctx, user, 0, 3), "Please pick a sport.")
	wantInvalid(t, svc.SaveQuota(ctx, user, 1, 0), "Sessions per week must be between 1 and 14.")
	wantInvalid(t, svc.SaveQuota(ctx, user, 1, 15), "Sessions per week must be between 1 and 14.")
	wantInvalid(t, svc.SaveQuota(ctx, user, 2, 3), "Unknown sport. Please pick one from the list.")
}
