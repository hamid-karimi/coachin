package training

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
)

type fakeCheckinStore struct {
	plan     CheckinPlan
	planErr  error
	checkins map[int]json.RawMessage
	items    []WeekItem
	logs     map[uuid.UUID]scorecard.SessionLog
	applied  []WeekAdjustment
	applyErr error
}

func (f *fakeCheckinStore) ActivePlan(context.Context, uuid.UUID, uuid.UUID) (CheckinPlan, error) {
	return f.plan, f.planErr
}

func (f *fakeCheckinStore) CheckinScorecard(_ context.Context, _, _ uuid.UUID, week int) (json.RawMessage, bool, error) {
	card, ok := f.checkins[week]
	return card, ok, nil
}

func (f *fakeCheckinStore) WeekItems(_ context.Context, _, _ uuid.UUID, from, to int) ([]WeekItem, error) {
	var items []WeekItem
	for _, item := range f.items {
		if item.Week >= from && item.Week <= to {
			items = append(items, item)
		}
	}
	return items, nil
}

func (f *fakeCheckinStore) SessionLogs(_ context.Context, _ uuid.UUID, ids []uuid.UUID) ([]LoggedSession, error) {
	var logs []LoggedSession
	for _, id := range ids {
		if log, ok := f.logs[id]; ok {
			logs = append(logs, LoggedSession{PlanItemID: id, Log: log})
		}
	}
	return logs, nil
}

func (f *fakeCheckinStore) ApplyWeekAdjustment(_ context.Context, _ uuid.UUID, adj WeekAdjustment) (int, error) {
	if f.applyErr != nil {
		return 0, f.applyErr
	}
	f.applied = append(f.applied, adj)
	return 20, nil
}

// checkinStore is a plan whose week 3 just ended (genNow is in week 4): two
// runs (one done, one skipped), and a squat logged at the same load in weeks
// 1–3; week 4 has one run.
func checkinStore() *fakeCheckinStore {
	store := &fakeCheckinStore{
		plan: CheckinPlan{
			ID: uuid.New(), WeeksTotal: 12, Summary: ptrTo("Build to a sub-4 marathon"),
			CreatedAt: time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC),
			Intake:    json.RawMessage(`{"race_distance_km":42.2,"experience_level":"intermediate","days_per_week":4}`),
		},
		checkins: map[int]json.RawMessage{2: json.RawMessage(`{"adherence_pct":40}`)},
		logs:     map[uuid.UUID]scorecard.SessionLog{},
	}
	add := func(week, day int, itemType, details string, done bool) uuid.UUID {
		id := uuid.New()
		store.items = append(store.items, WeekItem{
			ID: id, Week: week, DayOfWeek: day, ItemType: itemType, Title: itemType + " session",
			Details: json.RawMessage(details), IsCompleted: done,
		})
		return id
	}
	for week := 1; week <= 3; week++ {
		squat := add(week, 1, "strength", `{}`, true)
		store.logs[squat] = scorecard.SessionLog{Actual: map[string]any{"exercises": []any{
			map[string]any{"name": "Squat", "sets": []any{map[string]any{"reps": 5.0, "weight_kg": 100.0}}},
		}}}
	}
	run := add(3, 2, "run", `{"distance_km":5}`, true)
	store.logs[run] = scorecard.SessionLog{Actual: map[string]any{"distance_km": 6.0}}
	add(3, 4, "run", `{"distance_km":8}`, false)
	add(4, 2, "run", `{"distance_km":6,"pace_min_km":"6:00"}`, false)
	return store
}

func TestCheckinProposalWithAI(t *testing.T) {
	store := checkinStore()
	ai := &replyAI{text: `{"summary":"Slightly longer runs.","items":[{"week":9,"day_of_week":2,"item_type":"run","title":"Easy 6.5k","details":{"distance_km":6.5}}]}`}
	p, err := NewCheckins(store, ai, genNow).Proposal(context.Background(), uuid.New(), store.plan.ID)
	if err != nil {
		t.Fatal(err)
	}
	if p.ReviewWeek != 3 || p.TargetWeek != 4 {
		t.Fatalf("weeks = %d → %d", p.ReviewWeek, p.TargetWeek)
	}
	c := p.Scorecard
	if c.PlannedItems != 3 || c.CompletedItems != 2 || c.PlannedKm != 13 || c.ActualKm != 6 {
		t.Errorf("scorecard = %+v", c)
	}
	if len(c.CautionFlags) != 1 || c.CautionFlags[0] != "squat: same load 3 weeks running — consider a deload or variation" {
		t.Errorf("caution = %q", c.CautionFlags)
	}
	if p.Decision != scorecard.Advance || len(p.Reasons) != 2 {
		t.Errorf("decision = %s %q", p.Decision, p.Reasons)
	}
	if p.Summary != "Slightly longer runs." || len(p.Items) != 1 || p.Items[0].Week != 4 || p.Items[0].Title != "Easy 6.5k" {
		t.Errorf("proposal = %q %+v", p.Summary, p.Items)
	}
	prompt := ai.requests[0].Prompt
	if !strings.Contains(prompt, "42.2km race plan · intermediate runner · 4 days/week · Build to a sub-4 marathon") {
		t.Errorf("prompt lacks the intake summary:\n%s", prompt)
	}
}

func TestCheckinProposalWithoutAI(t *testing.T) {
	store := checkinStore()
	store.items[len(store.items)-2].IsCompleted = true // both runs done → no repeat
	store.logs = map[uuid.UUID]scorecard.SessionLog{}
	p, err := NewCheckins(store, &replyAI{}, genNow).Proposal(context.Background(), uuid.New(), store.plan.ID)
	if err != nil {
		t.Fatal(err)
	}
	want := "Keeping week 4 as planned. 3 of 3 sessions done (100%) — on track to advance."
	if p.Summary != want {
		t.Errorf("summary = %q", p.Summary)
	}
	item := p.Items[0]
	if len(p.Items) != 1 || item.Week != 4 || *item.Details.DistanceKm != 6 || *item.Details.PaceMinKm != "6:00" {
		t.Errorf("items = %+v", p.Items)
	}
}

func TestCheckinNotDue(t *testing.T) {
	cases := map[string]func(*fakeCheckinStore){
		"not the user's": func(s *fakeCheckinStore) { s.planErr = ErrNotFound },
		"week 1":         func(s *fakeCheckinStore) { s.plan.CreatedAt = genNow() },
		"last week":      func(s *fakeCheckinStore) { s.plan.WeeksTotal = 3 },
		"reviewed":       func(s *fakeCheckinStore) { s.checkins[3] = json.RawMessage(`{}`) },
		"no next week":   func(s *fakeCheckinStore) { s.items = s.items[:len(s.items)-1] },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			store := checkinStore()
			mutate(store)
			_, err := NewCheckins(store, &replyAI{}, genNow).Proposal(context.Background(), uuid.New(), store.plan.ID)
			if kindOf(err) != apperr.NotFound {
				t.Fatalf("err = %v", err)
			}
		})
	}
}

func TestCheckinConfirm(t *testing.T) {
	store := checkinStore()
	svc := NewCheckins(store, &replyAI{}, genNow)
	ctx, user := context.Background(), uuid.New()
	items := []aigen.PlanItemInput{
		{Week: 1, DayOfWeek: 2, ItemType: "run", Title: "  Easy 6k ", Details: aigen.ItemDetails{DistanceKm: ptrTo(6.04)}},
		{DayOfWeek: 9, ItemType: "run", Title: "bad day"},
	}

	_, err := svc.Confirm(ctx, user, CheckinInput{PlanID: store.plan.ID, CheckinWeek: 2, Items: items})
	if kindOf(err) != apperr.Conflict {
		t.Errorf("stale week: %v", err)
	}
	_, err = svc.Confirm(ctx, user, CheckinInput{PlanID: store.plan.ID, CheckinWeek: 3, Items: items[1:]})
	if kindOf(err) != apperr.Invalid {
		t.Errorf("no valid items: %v", err)
	}

	done, err := svc.Confirm(ctx, user, CheckinInput{PlanID: store.plan.ID, CheckinWeek: 3, Summary: "  Go on ", Items: items})
	if err != nil {
		t.Fatal(err)
	}
	if done.Message != "Week 4 updated · +20 XP" || done.AwardedXP != 20 {
		t.Errorf("done = %+v", done)
	}
	adj := store.applied[0]
	if adj.CheckinWeek != 3 || adj.TargetWeek != 4 || adj.Decision != scorecard.Advance || *adj.Summary != "Go on" {
		t.Errorf("adjustment = %+v", adj)
	}
	if len(adj.Items) != 1 || adj.Items[0].Week != 4 || adj.Items[0].Title != "Easy 6k" || *adj.Items[0].Details.DistanceKm != 6 {
		t.Errorf("items = %+v", adj.Items)
	}

	store.applyErr = ErrAlreadyCheckedIn
	_, err = svc.Confirm(ctx, user, CheckinInput{PlanID: store.plan.ID, CheckinWeek: 3, Items: items})
	if kindOf(err) != apperr.Conflict {
		t.Errorf("repeat: %v", err)
	}
}
