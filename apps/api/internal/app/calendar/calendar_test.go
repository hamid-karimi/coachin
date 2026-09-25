package calendar

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/quotas"
)

type fakeStore struct {
	schedules  []Schedule
	plans      []routine.Plan
	items      []PlanItem
	logs       []quotas.Log
	quotas     []routine.Quota
	weekByPlan map[uuid.UUID]int
	logWindow  [2]string
	menu       map[int][]nutrition.MealSlot
	mealLogs   map[string][]nutrition.MealSlot
}

func (f *fakeStore) MealPlanWeek(context.Context, uuid.UUID) (map[int][]nutrition.MealSlot, bool, error) {
	return f.menu, f.menu != nil, nil
}
func (f *fakeStore) MealSlots(context.Context, uuid.UUID, string, string) (map[string][]nutrition.MealSlot, error) {
	return f.mealLogs, nil
}

func (f *fakeStore) SchedulesBetween(context.Context, uuid.UUID, string, string) ([]Schedule, error) {
	return f.schedules, nil
}
func (f *fakeStore) ActivePlans(context.Context, uuid.UUID) ([]routine.Plan, error) {
	return f.plans, nil
}
func (f *fakeStore) PlanItemsInWeeks(_ context.Context, _ uuid.UUID, weekByPlan map[uuid.UUID]int) ([]PlanItem, error) {
	f.weekByPlan = weekByPlan
	var out []PlanItem
	for _, item := range f.items {
		if weekByPlan[item.PlanID] == item.Week {
			out = append(out, item)
		}
	}
	return out, nil
}
func (f *fakeStore) Logs(_ context.Context, _ uuid.UUID, from, to string) ([]quotas.Log, error) {
	f.logWindow = [2]string{from, to}
	return f.logs, nil
}
func (f *fakeStore) Quotas(context.Context, uuid.UUID) ([]routine.Quota, error) { return f.quotas, nil }

func ptr[T any](v T) *T { return &v }

// Thursday 2026-09-24; the week is Mon 21 – Sun 27.
var now = func() time.Time { return time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC) }

func TestWeek(t *testing.T) {
	run, lift := uuid.New(), uuid.New()
	running, gym := int64(1), int64(2)
	store := &fakeStore{
		schedules: []Schedule{
			{SportTypeID: &gym, SportName: ptr("Gym"), DayOfWeek: 1, Time: ptr("07:00")},
			{SportTypeID: &running, SportName: ptr("Running"), DayOfWeek: 3, StartsOn: ptr("2026-09-24")}, // Wed 23 is before it starts
			{SportTypeID: &gym, SportName: ptr("Gym"), DayOfWeek: 5, EndsOn: ptr("2026-09-24")},           // Fri 25 is after it ends
		},
		plans: []routine.Plan{
			{ID: lift, CreatedAt: time.Date(2026, 9, 16, 9, 0, 0, 0, time.UTC), WeeksTotal: 8}, // week 2 here
			{ID: run, CreatedAt: time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC), WeeksTotal: 12},  // week 4 here
		},
		items: []PlanItem{
			{PlanItem: routine.PlanItem{Title: "Upper A", ItemType: "strength", DayOfWeek: 4}, PlanID: lift, Week: 2},
			{PlanItem: routine.PlanItem{Title: "Tempo", ItemType: "run", DayOfWeek: 4}, PlanID: run, Week: 4},
			{PlanItem: routine.PlanItem{Title: "Long run", ItemType: "run", DayOfWeek: 0}, PlanID: run, Week: 4},
			{PlanItem: routine.PlanItem{Title: "Old", ItemType: "run", DayOfWeek: 4}, PlanID: run, Week: 3},
		},
		logs: []quotas.Log{
			{SportTypeID: &gym, Date: "2026-09-21", Status: "completed"},
			{SportTypeID: &running, Date: "2026-09-22", Status: "skipped"},
		},
		quotas: []routine.Quota{{SportTypeID: gym, SessionsPerWeek: 3}},
	}

	week, err := NewService(store, now).Week(context.Background(), uuid.New(), "")
	if err != nil {
		t.Fatal(err)
	}
	if week.Monday != "2026-09-21" || week.Sunday != "2026-09-27" || week.PrevWeek != "2026-09-14" ||
		week.NextWeek != "2026-09-28" || !week.IsCurrentWeek || week.Today != "2026-09-24" {
		t.Fatalf("week = %+v", week)
	}
	if store.logWindow != [2]string{"2026-09-21", "2026-09-27"} || store.weekByPlan[lift] != 2 || store.weekByPlan[run] != 4 {
		t.Errorf("window %v, weeks %v", store.logWindow, store.weekByPlan)
	}
	if len(week.Quotas) != 1 || week.Quotas[0].DoneThisWeek != 1 {
		t.Errorf("quotas = %+v", week.Quotas)
	}

	mon, tue, wed, thu, fri, sun := week.Days[0], week.Days[1], week.Days[2], week.Days[3], week.Days[4], week.Days[6]
	if mon.Weekday != 1 || !mon.Logged || len(mon.Routines) != 1 || !mon.Routines[0].Done {
		t.Errorf("monday = %+v", mon)
	}
	if tue.Logged {
		t.Error("a skipped log doesn't mark the day logged")
	}
	if len(wed.Routines) != 0 || len(fri.Routines) != 0 {
		t.Errorf("schedule window ignored: wed %+v fri %+v", wed.Routines, fri.Routines)
	}
	if !thu.IsToday || len(thu.PlanItems) != 2 || !thu.HardCollision {
		t.Errorf("thursday = %+v", thu)
	}
	if len(sun.PlanItems) != 1 || sun.PlanItems[0].Title != "Long run" || sun.HardCollision {
		t.Errorf("sunday = %+v", sun)
	}
}

func TestWeekAnchor(t *testing.T) {
	store := &fakeStore{}
	svc := NewService(store, now)
	week, _ := svc.Week(context.Background(), uuid.New(), "2026-10-04") // a Sunday
	if week.Monday != "2026-09-28" || week.IsCurrentWeek || week.Days[0].IsToday {
		t.Errorf("anchored week = %s current=%v", week.Monday, week.IsCurrentWeek)
	}
	if week, _ := svc.Week(context.Background(), uuid.New(), "nope"); week.Monday != "2026-09-21" {
		t.Errorf("bad anchor → %s", week.Monday)
	}
	if store.weekByPlan != nil {
		t.Error("no plans must skip the item query")
	}
	for _, d := range week.Days {
		if d.PlanItems == nil || d.Routines == nil {
			t.Fatalf("nil lists on %s", d.Date)
		}
	}
}

func TestWeekMeals(t *testing.T) {
	store := &fakeStore{
		menu: map[int][]nutrition.MealSlot{
			3: {{MealType: "breakfast", Kcal: 400}, {MealType: "dinner", Kcal: 600}}, // Wednesday
			5: {{MealType: "lunch", Kcal: 700}},                                      // Friday (future)
		},
		mealLogs: map[string][]nutrition.MealSlot{"2026-09-23": {{MealType: "breakfast", Kcal: 450}, {MealType: "snack", Kcal: 100}}},
	}
	week, err := NewService(store, now).Week(context.Background(), uuid.New(), "")
	if err != nil {
		t.Fatal(err)
	}
	wed, thu, fri := week.Days[2].Meals, week.Days[3].Meals, week.Days[4].Meals
	if wed == nil || wed.PlannedCount != 2 || wed.PlannedKcal != 1000 || wed.Adherence == nil ||
		wed.Adherence.SlotsLogged != 1 || wed.Adherence.KcalLogged != 550 {
		t.Errorf("wednesday = %+v", wed)
	}
	if thu != nil {
		t.Errorf("thursday has no planned meals: %+v", thu)
	}
	if fri == nil || fri.Adherence != nil {
		t.Errorf("friday (future) = %+v", fri)
	}
	store.menu = nil
	week, _ = NewService(store, now).Week(context.Background(), uuid.New(), "")
	if week.Days[2].Meals != nil {
		t.Error("meals without a plan")
	}
}
