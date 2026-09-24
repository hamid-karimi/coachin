package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/supplements"
)

type fakeSupplements struct {
	added    supplements.AddInput
	schedule string
	taken    bool
}

func (f *fakeSupplements) Add(_ context.Context, _ uuid.UUID, in supplements.AddInput) (string, error) {
	f.added = in
	return in.Name, nil
}
func (f *fakeSupplements) Reschedule(_ context.Context, _, _ uuid.UUID, kind string, _ []int) error {
	f.schedule = kind
	return nil
}
func (f *fakeSupplements) Remove(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (f *fakeSupplements) SetTaken(_ context.Context, _, _ uuid.UUID, taken bool) error {
	f.taken = taken
	return nil
}

func TestSupplementRoutes(t *testing.T) {
	fake := &fakeSupplements{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Supplements: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	id := uuid.NewString()

	rec := send(t, h, http.MethodPost, BasePath+"/supplements", `{"name":"Creatine","dose":"5g"}`, cookie)
	var result ResultBody
	_ = json.Unmarshal(rec.Body.Bytes(), &result)
	if rec.Code != http.StatusCreated || result.Message != "Creatine added to your daily stack." || fake.added.ScheduleType != "daily" {
		t.Fatalf("add: %d %s %+v", rec.Code, rec.Body, fake.added)
	}
	if rec := send(t, h, http.MethodPut, BasePath+"/supplements/"+id+"/schedule", `{"scheduleType":"custom","daysOfWeek":[1]}`, cookie); rec.Code != http.StatusOK || fake.schedule != "custom" {
		t.Fatalf("reschedule: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodPut, BasePath+"/supplements/"+id+"/taken", `{"taken":true}`, cookie); rec.Code != http.StatusOK || !fake.taken {
		t.Fatalf("taken: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/supplements/"+id, "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("remove: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/supplements", `{"name":"x"}`, nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out: %d", rec.Code)
	}
}
