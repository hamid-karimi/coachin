package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/coaching"
	domaincoaching "github.com/hamid-karimi/coachin/apps/api/internal/domain/coaching"
)

type fakeCoaching struct{ coach bool }

func (f *fakeCoaching) Hub(context.Context, uuid.UUID) (coaching.Hub, error) {
	if !f.coach {
		return coaching.Hub{}, apperr.New(apperr.Forbidden, "Only coaches can open the coaching hub.")
	}
	email := "ada@example.com"
	return coaching.Hub{WeekStart: "2026-09-21", Trainees: []coaching.Trainee{{
		TraineeRow: coaching.TraineeRow{ID: uuid.New(), Email: &email, Level: 3},
		Week:       []domaincoaching.Day{{Date: "2026-09-21", Weekday: 1, State: domaincoaching.Done}},
		Plans:      []coaching.PlanAdherence{},
	}}, InviteCodes: []coaching.InviteCode{{Code: "COACH-1-AB", IsActive: true, Sport: &coaching.Sport{ID: 1, Name: "Running"}}}}, nil
}
func (f *fakeCoaching) Summary(context.Context, uuid.UUID) (coaching.Summary, error) {
	return coaching.Summary{TraineeCount: 2, TrainedThisWeek: 1}, nil
}
func (f *fakeCoaching) GenerateInviteCode(context.Context, uuid.UUID, int64) (string, error) {
	return "COACH-1-XYZ234", nil
}
func (f *fakeCoaching) Join(context.Context, uuid.UUID, string) (coaching.Joined, error) {
	return coaching.Joined{Status: "info", Message: "You’re already connected to this coach."}, nil
}
func (f *fakeCoaching) AssignWeeklyPlan(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "", apperr.New(apperr.Invalid, "Coach has no schedule to assign")
}

func TestCoachingRoutes(t *testing.T) {
	fake := &fakeCoaching{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Coaching: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	if rec := send(t, h, http.MethodGet, BasePath+"/coaching", "", cookie); rec.Code != http.StatusForbidden {
		t.Fatalf("trainee hub: %d", rec.Code)
	}
	fake.coach = true
	rec := send(t, h, http.MethodGet, BasePath+"/coaching", "", cookie)
	var hub CoachingHubBody
	_ = json.Unmarshal(rec.Body.Bytes(), &hub)
	if rec.Code != http.StatusOK || hub.Trainees[0].Name != "ada@example.com" || hub.Trainees[0].Tier != "bronze" ||
		hub.Trainees[0].Week[0].State != "done" || hub.InviteCodes[0].Sport.Name != "Running" {
		t.Fatalf("hub: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/coaching/invite-codes", `{"sportTypeId":1}`, cookie)
	var created InviteCodeCreatedBody
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != http.StatusCreated || created.Code != "COACH-1-XYZ234" || created.Message != "New invite code generated: COACH-1-XYZ234" {
		t.Fatalf("invite: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/coaching/join", `{"code":"coach-1-xyz234"}`, cookie); rec.Code != http.StatusOK {
		t.Fatalf("join: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/coaching/trainees/"+uuid.NewString()+"/weekly-plan", "", cookie); rec.Code != http.StatusBadRequest {
		t.Fatalf("assign: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/coaching/summary", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("summary: %d", rec.Code)
	}
}
