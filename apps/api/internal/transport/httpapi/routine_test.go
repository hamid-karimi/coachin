package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
)

type fakeRoutine struct {
	user    uuid.UUID
	added   routine.AddSchedulesInput
	quota   [2]int64
	deleted uuid.UUID
}

func (f *fakeRoutine) SportTypes(context.Context) ([]routine.SportType, error) {
	half := 1.5
	return []routine.SportType{{ID: 1, Name: "Running"}, {ID: 2, Name: "Rowing", XPMultiplier: &half}}, nil
}

func (f *fakeRoutine) Week(_ context.Context, userID uuid.UUID) (routine.Week, error) {
	f.user = userID
	km, name, at := 8.0, "Running", "07:00"
	return routine.Week{
		Schedules:         []routine.Schedule{{DayOfWeek: 1, SportName: &name, Time: &at}},
		Quotas:            []routine.QuotaProgress{{Quota: routine.Quota{SportTypeID: 1, SessionsPerWeek: 3}, DoneThisWeek: 2}},
		PlanItems:         []routine.PlanItem{{Title: "Tempo", ItemType: "run", Details: planitem.Details{DistanceKm: &km}}},
		EstimatedWeeklyXP: 60,
	}, nil
}

func (f *fakeRoutine) AddSchedules(_ context.Context, _ uuid.UUID, in routine.AddSchedulesInput) (int, error) {
	if len(in.Days) == 0 {
		return 0, apperr.New(apperr.Invalid, "Please fill in all required fields.")
	}
	f.added = in
	return len(in.Days), nil
}

func (f *fakeRoutine) DeleteSchedule(_ context.Context, _, id uuid.UUID) error {
	f.deleted = id
	return nil
}

func (f *fakeRoutine) SaveQuota(_ context.Context, _ uuid.UUID, sport int64, n int) error {
	f.quota = [2]int64{sport, int64(n)}
	return nil
}

func (f *fakeRoutine) DeleteQuota(_ context.Context, _ uuid.UUID, sport int64) error {
	f.quota = [2]int64{sport, 0}
	return nil
}

func newRoutineServer(t *testing.T) (http.Handler, *fakeRoutine, map[string]string) {
	t.Helper()
	authn := &fakeAuth{user: uuid.New(), liveToken: "live-token"}
	fake := &fakeRoutine{}
	handler, _ := New(Deps{Auth: authn, Routine: fake})
	return handler, fake, map[string]string{"Cookie": "coachin_session=live-token"}
}

func TestRoutineNeedsASession(t *testing.T) {
	h, _, _ := newRoutineServer(t)
	for _, path := range []string{"/routine", "/sport-types"} {
		if rec := send(t, h, http.MethodGet, BasePath+path, "", nil); rec.Code != http.StatusUnauthorized {
			t.Errorf("%s without cookie: %d", path, rec.Code)
		}
	}
}

func TestGetRoutine(t *testing.T) {
	h, _, cookie := newRoutineServer(t)
	rec := send(t, h, http.MethodGet, BasePath+"/routine", "", cookie)
	var body RoutineBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusOK || len(body.Schedules) != 1 || *body.Schedules[0].Time != "07:00" ||
		body.Quotas[0].DoneThisWeek != 2 || *body.PlanItems[0].Details.DistanceKm != 8 || body.EstimatedWeeklyXP != 60 {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
}

func TestSportTypesReportEffectiveMultiplier(t *testing.T) {
	h, _, cookie := newRoutineServer(t)
	rec := send(t, h, http.MethodGet, BasePath+"/sport-types", "", cookie)
	var body []SportTypeBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if len(body) != 2 || body[0].XPMultiplier != 1 || body[1].XPMultiplier != 1.5 {
		t.Fatalf("got %s", rec.Body)
	}
}

func TestAddSchedules(t *testing.T) {
	h, fake, cookie := newRoutineServer(t)
	rec := send(t, h, http.MethodPost, BasePath+"/routine/schedules", `{"sportTypeId":1,"days":[1,3],"time":"07:00"}`, cookie)
	var result ResultBody
	_ = json.Unmarshal(rec.Body.Bytes(), &result)
	if rec.Code != http.StatusCreated || result.Message != "2 sessions added to your schedule." || fake.added.Time != "07:00" {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}

	rec = send(t, h, http.MethodPost, BasePath+"/routine/schedules", `{"sportTypeId":1,"days":[]}`, cookie)
	var problem struct{ Detail string }
	_ = json.Unmarshal(rec.Body.Bytes(), &problem)
	if rec.Code != http.StatusBadRequest || problem.Detail != "Please fill in all required fields." {
		t.Fatalf("invalid: %d %s", rec.Code, rec.Body)
	}
}

func TestQuotaAndDeleteRoutes(t *testing.T) {
	h, fake, cookie := newRoutineServer(t)
	if rec := send(t, h, http.MethodPut, BasePath+"/routine/quotas/4", `{"sessionsPerWeek":3}`, cookie); rec.Code != http.StatusOK || fake.quota != [2]int64{4, 3} {
		t.Fatalf("save quota: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/routine/quotas/4", "", cookie); rec.Code != http.StatusOK || fake.quota != [2]int64{4, 0} {
		t.Fatalf("delete quota: %d %s", rec.Code, rec.Body)
	}
	id := uuid.New()
	if rec := send(t, h, http.MethodDelete, BasePath+"/routine/schedules/"+id.String(), "", cookie); rec.Code != http.StatusOK || fake.deleted != id {
		t.Fatalf("delete schedule: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/routine/schedules/not-a-uuid", "", cookie); rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("bad id: %d", rec.Code)
	}
}
