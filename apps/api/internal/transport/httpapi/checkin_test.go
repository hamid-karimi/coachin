package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
)

type fakeSessions struct{ in training.SessionInput }

func (f *fakeSessions) LogSession(_ context.Context, _ uuid.UUID, in training.SessionInput) (training.SessionLogged, error) {
	f.in = in
	if in.Sport == "strength" {
		return training.SessionLogged{}, apperr.New(apperr.Conflict, "Session already logged")
	}
	return training.SessionLogged{
		Message: "Session logged · +10 XP 🏃 Good.", AwardedXP: 10,
		Feedback: &aigen.Feedback{Message: "Good.", Flag: aigen.FlagOK},
	}, nil
}

type fakeCheckins struct{ confirmed training.CheckinInput }

func (f *fakeCheckins) Proposal(_ context.Context, _, planID uuid.UUID) (training.Proposal, error) {
	return training.Proposal{
		PlanID: planID, ReviewWeek: 3, TargetWeek: 4, Decision: scorecard.Repeat, Reasons: []string{"Only 1 of 3"},
		Scorecard: scorecard.Week{AdherencePct: 33.3, RedFlags: []string{}, CautionFlags: []string{}},
		Summary:   "Same again.",
		Items:     []aigen.PlanItemInput{{Week: 4, DayOfWeek: 2, ItemType: "run", Title: "Easy", Details: aigen.ItemDetails{DistanceKm: ptr(5.0)}}},
	}, nil
}

func (f *fakeCheckins) Confirm(_ context.Context, _ uuid.UUID, in training.CheckinInput) (training.Confirmed, error) {
	f.confirmed = in
	return training.Confirmed{Message: "Week 4 updated · +20 XP", AwardedXP: 20}, nil
}

func ptr[T any](v T) *T { return &v }

func TestSessionLogAndCheckinRoutes(t *testing.T) {
	sessions, checkins := &fakeSessions{}, &fakeCheckins{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Sessions: sessions, Checkins: checkins})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}
	item := uuid.NewString()

	rec := send(t, h, http.MethodPost, BasePath+"/plan-items/"+item+"/session-log", `{"sport":"run","rpe":6,"distanceKm":5.2,"avgHr":150.6}`, cookie)
	var logged SessionLoggedBody
	_ = json.Unmarshal(rec.Body.Bytes(), &logged)
	if rec.Code != http.StatusCreated || logged.AwardedXP != 10 || logged.Feedback.Flag != "ok" || *sessions.in.AvgHR != 150.6 {
		t.Fatalf("log: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/plan-items/"+item+"/session-log",
		`{"sport":"strength","exercises":[{"name":"Squat","sets":[{"reps":5,"weight_kg":100}]}]}`, cookie)
	if rec.Code != http.StatusConflict || sessions.in.Exercises == nil {
		t.Fatalf("repeat log: %d %s", rec.Code, rec.Body)
	}

	plan := uuid.NewString()
	rec = send(t, h, http.MethodGet, BasePath+"/training/plans/"+plan+"/checkin", "", cookie)
	var proposal CheckinProposalBody
	_ = json.Unmarshal(rec.Body.Bytes(), &proposal)
	if rec.Code != http.StatusOK || proposal.Decision != "repeat" || proposal.Scorecard.AdherencePct != 33.3 ||
		len(proposal.Items) != 1 || *proposal.Items[0].Details.DistanceKm != 5 {
		t.Fatalf("proposal: %d %s", rec.Code, rec.Body)
	}

	rec = send(t, h, http.MethodPost, BasePath+"/training/plans/"+plan+"/checkin",
		`{"checkinWeek":3,"summary":"Same again.","items":[{"dayOfWeek":2,"itemType":"run","title":"Easy","details":{"distanceKm":5}}]}`, cookie)
	c := checkins.confirmed
	if rec.Code != http.StatusOK || c.CheckinWeek != 3 || c.PlanID.String() != plan || len(c.Items) != 1 || *c.Items[0].Details.DistanceKm != 5 {
		t.Fatalf("confirm: %d %s %+v", rec.Code, rec.Body, c)
	}
}
