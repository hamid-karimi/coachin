package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/goals"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/progress"
)

type fakeProfile struct {
	body    profile.BodyInput
	weight  *float64
	goal    profile.GoalInput
	sharing bool
}

func (f *fakeProfile) Body(context.Context, uuid.UUID) (profile.Body, error) {
	sex := "male"
	return profile.Body{Sex: &sex, NutritionSharing: true}, nil
}
func (f *fakeProfile) UpdateBody(_ context.Context, _ uuid.UUID, in profile.BodyInput) (string, error) {
	f.body = in
	return "Profile updated.", nil
}
func (f *fakeProfile) SetNutritionSharing(_ context.Context, _ uuid.UUID, enabled bool) (string, error) {
	f.sharing = enabled
	return profile.SharingMessage[enabled], nil
}
func (f *fakeProfile) Overview(context.Context, uuid.UUID) (profile.Overview, error) {
	return profile.Overview{WorkoutCount: 3, RecentXP: []profile.XPEntry{{Amount: 60, Label: "Running workout"}}}, nil
}
func (f *fakeProfile) Progress(context.Context, uuid.UUID) (profile.Progress, error) {
	return profile.Progress{
		Measurements: []profile.Measurement{{MeasuredAt: "2026-09-20"}},
		WeeklyVolume: []progress.ChartPoint{{Label: "Sep 21", Value: 1200}}, WeeklyKm: []progress.ChartPoint{},
		Weight: []progress.ChartPoint{}, TopSets: []progress.ExerciseTrend{},
	}, nil
}
func (f *fakeProfile) AddMeasurement(_ context.Context, _ uuid.UUID, weightKg, _ *float64) (profile.Logged, error) {
	f.weight = weightKg
	return profile.Logged{Message: "Goal achieved: Weight 70kg! +200 XP", Achieved: []string{"Weight 70kg"}}, nil
}
func (f *fakeProfile) DeleteMeasurement(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "", apperr.New(apperr.NotFound, "Measurement not found")
}
func (f *fakeProfile) Goals(context.Context, uuid.UUID) (profile.GoalsPage, error) {
	start, current := 80.0, 75.0
	return profile.GoalsPage{
		Active: []profile.ActiveGoal{{
			Goal: profile.Goal{Type: goals.Weight, Target: 70, Start: &start}, Current: &current,
			Progress: &goals.Progress{Pct: 50, Direction: goals.Down},
		}},
		Achieved: []profile.Goal{},
	}, nil
}
func (f *fakeProfile) CreateGoal(_ context.Context, _ uuid.UUID, in profile.GoalInput) (string, error) {
	f.goal = in
	return "", apperr.New(apperr.Conflict, profile.DuplicateGoalMessage(goals.Weight))
}
func (f *fakeProfile) AbandonGoal(context.Context, uuid.UUID, uuid.UUID) (string, error) {
	return "Goal removed.", nil
}

func TestProfileRoutes(t *testing.T) {
	fake := &fakeProfile{}
	h, _ := New(Deps{Auth: &fakeAuth{user: uuid.New(), liveToken: "live-token"}, Profile: fake})
	cookie := map[string]string{"Cookie": "coachin_session=live-token"}

	rec := send(t, h, http.MethodGet, BasePath+"/me/body", "", cookie)
	var body BodyProfileBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if rec.Code != http.StatusOK || *body.Sex != "male" || !body.NutritionSharing {
		t.Fatalf("body: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPut, BasePath+"/me/body", `{"birthDate":"1994-05-01","heightCm":181.5,"country":"Iran"}`, cookie)
	if rec.Code != http.StatusOK || fake.body.BirthDate != "1994-05-01" || *fake.body.HeightCm != 181.5 || fake.body.Sex != "" {
		t.Fatalf("update: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPut, BasePath+"/me/nutrition-sharing", `{"enabled":false}`, cookie)
	var res ResultBody
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if rec.Code != http.StatusOK || res.Status != "info" || res.Message != "Nutrition sharing turned off." {
		t.Fatalf("sharing: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/me/overview", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("overview: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/me/progress", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("progress: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/measurements", `{"weightKg":69.5}`, cookie)
	var logged MeasurementLoggedBody
	_ = json.Unmarshal(rec.Body.Bytes(), &logged)
	if rec.Code != http.StatusCreated || *fake.weight != 69.5 || logged.AchievedGoals[0] != "Weight 70kg" {
		t.Fatalf("measurement: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodDelete, BasePath+"/measurements/"+uuid.NewString(), "", cookie); rec.Code != http.StatusNotFound {
		t.Fatalf("delete measurement: %d", rec.Code)
	}
	rec = send(t, h, http.MethodGet, BasePath+"/goals", "", cookie)
	var page GoalsBody
	_ = json.Unmarshal(rec.Body.Bytes(), &page)
	if rec.Code != http.StatusOK || page.Active[0].Progress.Direction != "down" || *page.Active[0].Current != 75 {
		t.Fatalf("goals: %d %s", rec.Code, rec.Body)
	}
	rec = send(t, h, http.MethodPost, BasePath+"/goals", `{"goalType":"weight","target":70,"targetDate":"2026-12-31"}`, cookie)
	if rec.Code != http.StatusConflict || fake.goal.TargetDate != "2026-12-31" {
		t.Fatalf("create goal: %d %s", rec.Code, rec.Body)
	}
	if rec := send(t, h, http.MethodPost, BasePath+"/goals/"+uuid.NewString()+"/abandon", "", cookie); rec.Code != http.StatusOK {
		t.Fatalf("abandon: %d", rec.Code)
	}
	if rec := send(t, h, http.MethodGet, BasePath+"/goals", "", nil); rec.Code != http.StatusUnauthorized {
		t.Fatalf("signed out: %d", rec.Code)
	}
}
