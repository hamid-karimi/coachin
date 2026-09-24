package training

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

type fakeGenStore struct {
	role     string
	coaches  bool
	athlete  Athlete
	anchors  []aigen.Anchor
	calories *float64
	saved    []NewPlan
	savedBy  uuid.UUID
}

func (f *fakeGenStore) Role(context.Context, uuid.UUID) (string, error) { return f.role, nil }
func (f *fakeGenStore) Coaches(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return f.coaches, nil
}
func (f *fakeGenStore) Athlete(context.Context, uuid.UUID, uuid.UUID) (Athlete, error) {
	return f.athlete, nil
}
func (f *fakeGenStore) Anchors(context.Context, uuid.UUID, uuid.UUID, string) ([]aigen.Anchor, error) {
	return f.anchors, nil
}
func (f *fakeGenStore) CalorieTarget(context.Context, uuid.UUID, uuid.UUID) (*float64, error) {
	return f.calories, nil
}
func (f *fakeGenStore) BodyAnalysis(context.Context, uuid.UUID, uuid.UUID) (*string, error) {
	return nil, nil
}
func (f *fakeGenStore) CreatePlan(_ context.Context, acting uuid.UUID, plan NewPlan) (uuid.UUID, error) {
	f.saved, f.savedBy = append(f.saved, plan), acting
	return uuid.New(), nil
}

// fakeAI answers with a plan of `perWeek` runs per week, recording prompts.
type fakeAI struct {
	perWeek int
	down    bool
	prompts []string
}

func (f *fakeAI) GenerateJSON(_ context.Context, req aigen.Request) (aigen.Result, bool) {
	f.prompts = append(f.prompts, req.Prompt)
	if f.down {
		return aigen.Result{}, false
	}
	var items []string
	for week := 1; week <= 24; week++ {
		for day := 0; day < f.perWeek; day++ {
			items = append(items, fmt.Sprintf(`{"week":%d,"day_of_week":%d,"item_type":"run","title":"Run"}`, week, day))
		}
	}
	return aigen.Result{Text: `{"summary":"Plan","items":[` + strings.Join(items, ",") + `]}`, Model: "fake-model"}, true
}

// 2026-09-24 (Thursday).
var genNow = func() time.Time { return time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC) }

func runningInput(mode string) RunningInput {
	return RunningInput{Mode: mode, RaceTarget: "half", RaceDate: "2027-01-10", DaysPerWeek: 4, ExperienceLevel: "regular"}
}

func TestGenerateRunningValidation(t *testing.T) {
	ctx, user := context.Background(), uuid.New()
	gen := NewGeneration(&fakeGenStore{}, &fakeAI{perWeek: 3}, genNow)
	mutate := func(f func(*RunningInput)) RunningInput {
		in := runningInput("race")
		f(&in)
		return in
	}
	cases := map[string]RunningInput{
		"Pick your race distance":                              mutate(func(in *RunningInput) { in.RaceTarget = "marathon" }),
		"Enter the race distance in km (1-500)":                mutate(func(in *RunningInput) { in.RaceTarget = "ultra" }),
		"Pick your race date":                                  mutate(func(in *RunningInput) { in.RaceDate = "soon" }),
		"Race must be at least 4 weeks away for a useful plan": mutate(func(in *RunningInput) { in.RaceDate = "2026-10-15" }),
		"Pick 2-7 training days per week":                      mutate(func(in *RunningInput) { in.DaysPerWeek = 8 }),
	}
	for want, in := range cases {
		_, err := gen.GenerateRunning(ctx, user, in)
		var appErr *apperr.Error
		if !asAppErr(err, &appErr) || appErr.Message != want {
			t.Errorf("want %q, got %v", want, err)
		}
	}
}

func asAppErr(err error, target **apperr.Error) bool { return errors.As(err, target) }

func TestGenerateRunningRace(t *testing.T) {
	store := &fakeGenStore{athlete: Athlete{BirthDate: ptrTo("1990-01-15"), WeightKg: ptrTo(70.0)}}
	ai := &fakeAI{perWeek: 3}
	in := runningInput("race")
	in.PB10k, in.GoalTime, in.PBFull = "48:00", "1:45:00", "not a time"
	created, err := NewGeneration(store, ai, genNow).GenerateRunning(context.Background(), uuid.New(), in)
	if err != nil || created.ForStudent {
		t.Fatalf("created = %+v, %v", created, err)
	}
	plan := store.saved[0]
	var intake aigen.MarathonIntake
	_ = json.Unmarshal(plan.Intake, &intake)
	// 2026-09-24 → 2027-01-10 is 15 whole weeks.
	if plan.WeeksTotal != 15 || plan.PlanKind != "race" || *plan.RaceDate != "2027-01-10" || *plan.GoalTime != "1:45:00" ||
		!intake.FirstTimeAtDistance || intake.PBFull != nil || *intake.Age != 36 || len(plan.Items) != 24*3 || plan.Model != "fake-model" {
		t.Errorf("plan = %+v, intake = %+v", plan, intake)
	}
	if !strings.Contains(ai.prompts[0], "15-week training plan for a 21.0975km race (half)") {
		t.Errorf("prompt = %s", ai.prompts[0])
	}
}

func TestGenerateRunningBase(t *testing.T) {
	store := &fakeGenStore{}
	in := runningInput("base")
	in.RaceTarget, in.RaceDate, in.ExperienceLevel = "", "", "new"
	twelve := 12.0
	in.BaseWeeks = &twelve
	if _, err := NewGeneration(store, &fakeAI{perWeek: 3}, genNow).GenerateRunning(context.Background(), uuid.New(), in); err != nil {
		t.Fatal(err)
	}
	var intake aigen.MarathonIntake
	_ = json.Unmarshal(store.saved[0].Intake, &intake)
	if store.saved[0].WeeksTotal != 12 || store.saved[0].RaceDate != nil || intake.RaceTarget != "base" || !intake.FirstTimeAtDistance {
		t.Errorf("base plan = %+v", intake)
	}
}

func TestGenerationFailuresAndCoachMode(t *testing.T) {
	ctx, user, trainee := context.Background(), uuid.New(), uuid.New()
	kind := func(err error) apperr.Kind {
		var appErr *apperr.Error
		if asAppErr(err, &appErr) {
			return appErr.Kind
		}
		return 0
	}
	hyper := HypertrophyInput{Goal: "muscle_gain", Equipment: "gym", DaysPerWeek: 4, WeeksTotal: 8}

	if _, err := NewGeneration(&fakeGenStore{}, &fakeAI{down: true}, genNow).GenerateHypertrophy(ctx, user, hyper); kind(err) != apperr.Unavailable {
		t.Errorf("AI down: %v", err)
	}
	_, err := NewGeneration(&fakeGenStore{}, &fakeAI{perWeek: 0}, genNow).GenerateHypertrophy(ctx, user, hyper)
	if kind(err) != apperr.Unavailable || err.Error() != aigen.ErrIncomplete.Error() {
		t.Errorf("incomplete: %v", err)
	}

	coachMode := hyper
	coachMode.TargetStudentID = &trainee
	if _, err := NewGeneration(&fakeGenStore{role: "student"}, &fakeAI{perWeek: 3}, genNow).GenerateHypertrophy(ctx, user, coachMode); kind(err) != apperr.Forbidden {
		t.Errorf("student as coach: %v", err)
	}
	if _, err := NewGeneration(&fakeGenStore{role: "coach"}, &fakeAI{perWeek: 3}, genNow).GenerateHypertrophy(ctx, user, coachMode); kind(err) != apperr.Forbidden {
		t.Errorf("not their trainee: %v", err)
	}
	store := &fakeGenStore{role: "coach", coaches: true, calories: ptrTo(2400.0)}
	created, err := NewGeneration(store, &fakeAI{perWeek: 3}, genNow).GenerateHypertrophy(ctx, user, coachMode)
	if err != nil || !created.ForStudent || *store.saved[0].Target != trainee || store.savedBy != user {
		t.Fatalf("coach mode: %+v, %v", created, err)
	}
	if !strings.Contains(string(store.saved[0].Intake), `"plan_kind":"hypertrophy"`) || !strings.Contains(string(store.saved[0].Intake), `"calorie_target":2400`) {
		t.Errorf("intake = %s", store.saved[0].Intake)
	}

	intake, err := NewGeneration(&fakeGenStore{role: "coach", coaches: true, athlete: Athlete{Email: ptrTo("t@x.io")}}, nil, genNow).Intake(ctx, user, &trainee)
	if err != nil || intake.AthleteName != "t@x.io" || !intake.ForStudent {
		t.Errorf("intake context = %+v, %v", intake, err)
	}
}

func ptrTo[T any](v T) *T { return &v }
