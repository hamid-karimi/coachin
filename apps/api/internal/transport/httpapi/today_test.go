package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/tiers"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
)

type fakeToday struct{ lastSport int64 }

func (f *fakeToday) Today(context.Context, uuid.UUID) (today.Day, error) {
	name := "Running"
	return today.Day{
		Date: "2026-09-24", Weekday: 4,
		Stats:     today.Stats{XP: 1500, Level: 2, LevelProgress: xp.LevelProgress(1500), Hearts: 3, Tier: tiers.Bronze},
		Sessions:  []today.Session{{SessionRow: today.SessionRow{SportName: &name}, Multiplier: 1, EstimatedXP: 60}},
		PlanItems: []today.PlanItem{{PlanItemRow: today.PlanItemRow{PlanItem: routine.PlanItem{Title: "Tempo", ItemType: "run"}, Week: 3}, Date: "2026-09-24"}},
		Quotas:    []routine.QuotaProgress{},
		DoneCount: 0, TotalCount: 2,
	}, nil
}

func (f *fakeToday) LogWorkout(_ context.Context, _ uuid.UUID, sport int64) (today.LoggedWorkout, error) {
	if sport == 9 {
		return today.LoggedWorkout{}, apperr.New(apperr.Conflict, "Already logged today — nice work.")
	}
	f.lastSport = sport
	return today.LoggedWorkout{EarnedXP: 72, Multiplier: 1.2, TotalXP: 1572}, nil
}

type fakePlanItems struct{}

func (fakePlanItems) SetPlanItemCompleted(_ context.Context, _, _ uuid.UUID, completed bool) (int, error) {
	if completed {
		return 60, nil
	}
	return -60, nil
}

func newTodayServer(t *testing.T) (http.Handler, *fakeToday, map[string]string) {
	t.Helper()
	fake := &fakeToday{}
	handler, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Today: fake, PlanItems: fakePlanItems{}})
	return handler, fake, map[string]string{"Cookie": "coachin_session=live-token"}
}

func TestGetToday(t *testing.T) {
	h, _, cookie := newTodayServer(t)
	if rec := send(t, h, http.MethodGet, BasePath+"/today", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("no cookie: %d", rec.Code)
	}
	rec := send(t, h, http.MethodGet, BasePath+"/today", "", cookie)
	var body TodayBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusOK || body.Stats.CurrentXP != 500 || body.Stats.Tier != "bronze" ||
		body.Sessions[0].EstimatedXP != 60 || body.PlanItems[0].Week != 3 || body.PlanItems[0].Date != "2026-09-24" || body.TotalCount != 2 {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
}

func TestLogWorkoutRoute(t *testing.T) {
	h, fake, cookie := newTodayServer(t)
	rec := send(t, h, http.MethodPost, BasePath+"/today/workouts", `{"sportTypeId":4}`, cookie)
	var body WorkoutLoggedBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusCreated || body.Message != "+72 XP earned" || body.TotalXP != 1572 || fake.lastSport != 4 {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/today/workouts", `{"sportTypeId":9}`, cookie); rec.Code != http.StatusConflict {
		t.Fatalf("duplicate: %d", rec.Code)
	}
}

func TestPlanItemCompletionRoute(t *testing.T) {
	h, _, cookie := newTodayServer(t)
	path := BasePath + "/plan-items/" + uuid.NewString() + "/completion"
	for body, want := range map[string]PlanItemCompletionBody{
		`{"completed":true}`:  {Status: "success", Message: "+60 XP earned", AwardedXP: 60},
		`{"completed":false}`: {Status: "info", Message: "Undone · -60 XP", AwardedXP: -60},
	} {
		rec := send(t, h, http.MethodPut, path, body, cookie)
		var got PlanItemCompletionBody
		_ = json.Unmarshal(rec.Body.Bytes(), &got)
		if rec.Code != http.StatusOK || got != want {
			t.Errorf("%s: %d %+v", body, rec.Code, got)
		}
	}
	if got := completionFeedback(0); got.Message != "" {
		t.Errorf("no-op toggle message = %q", got.Message)
	}
}
