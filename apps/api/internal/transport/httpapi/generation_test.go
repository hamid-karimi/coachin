package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
)

type fakeGeneration struct {
	running training.RunningInput
}

func (f *fakeGeneration) Intake(_ context.Context, _ uuid.UUID, student *uuid.UUID) (training.IntakeContext, error) {
	if student != nil {
		return training.IntakeContext{}, apperr.New(apperr.Forbidden, "This trainee is not coached by you")
	}
	age, sex := 36, "female"
	return training.IntakeContext{Age: &age, Athlete: training.Athlete{Sex: &sex}}, nil
}

func (f *fakeGeneration) GenerateRunning(_ context.Context, _ uuid.UUID, in training.RunningInput) (training.Created, error) {
	f.running = in
	return training.Created{PlanID: uuid.New()}, nil
}

func (f *fakeGeneration) GenerateHypertrophy(context.Context, uuid.UUID, training.HypertrophyInput) (training.Created, error) {
	return training.Created{}, apperr.New(apperr.Unavailable, "AI plan generation is temporarily unavailable (quota or network) — try again later")
}

func TestGenerationRoutes(t *testing.T) {
	fake := &fakeGeneration{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Generation: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}

	rec := send(t, h, http.MethodGet, BasePath+"/training/intake-context", "", cookie)
	var intake IntakeContextBody
	_ = json.Unmarshal(rec.Body.Bytes(), &intake)
	if rec.Code != http.StatusOK || *intake.Age != 36 || *intake.Sex != "female" || intake.ForStudent {
		t.Fatalf("intake: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/training/intake-context?student="+uuid.NewString(), "", cookie); rec.Code != http.StatusForbidden {
		t.Fatalf("coach mode without relationship: %d", rec.Code)
	}

	rec = send(t, h, http.MethodPost, BasePath+"/training/plans/running",
		`{"mode":"race","raceTarget":"half","raceDate":"2027-01-10","daysPerWeek":4,"pb10k":"48:00","activities":[{"date":"2026-09-01"}]}`, cookie)
	var created PlanCreatedBody
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if rec.Code != http.StatusCreated || created.PlanID == uuid.Nil || fake.running.PB10k != "48:00" || fake.running.Activities == nil {
		t.Fatalf("running: %d %s %+v", rec.Code, rec.Body, fake.running)
	}

	rec = send(t, h, http.MethodPost, BasePath+"/training/plans/hypertrophy", `{"goal":"recomp","equipment":"home","daysPerWeek":3,"weeksTotal":8}`, cookie)
	var problem struct{ Detail string }
	_ = json.Unmarshal(rec.Body.Bytes(), &problem)
	if rec.Code != http.StatusBadGateway || problem.Detail == "" {
		t.Fatalf("AI down: %d %s", rec.Code, rec.Body)
	}
}
