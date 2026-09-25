package profile

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/goals"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/progress"
)

var (
	user = uuid.New()
	now  = time.Date(2026, 9, 25, 10, 0, 0, 0, time.UTC)
)

func f(v float64) *float64 { return &v }

type fakeStore struct {
	body      BodyUpdate
	sharing   *bool
	goals     []Goal
	values    Values
	created   []Goal
	decisions []Decision
	deleted   bool
	abandoned bool
}

func (s *fakeStore) Body(context.Context, uuid.UUID) (Body, error) { return Body{}, nil }
func (s *fakeStore) UpdateBody(_ context.Context, _ uuid.UUID, b BodyUpdate) error {
	s.body = b
	return nil
}
func (s *fakeStore) SetNutritionSharing(_ context.Context, _ uuid.UUID, enabled bool) error {
	s.sharing = &enabled
	return nil
}
func (s *fakeStore) Overview(context.Context, uuid.UUID, int) (OverviewRow, error) {
	reason := "workout_log:1"
	return OverviewRow{WorkoutCount: 4, RecentXP: []XPRow{{Amount: 60, Reason: &reason}}, SportNames: map[int64]string{1: "Running"}}, nil
}
func (s *fakeStore) Measurements(context.Context, uuid.UUID, int) ([]Measurement, error) {
	return []Measurement{
		{MeasuredAt: "2026-09-20", WeightKg: f(79.5)}, {MeasuredAt: "2026-09-20", WeightKg: f(80)},
		{MeasuredAt: "2026-09-10", WeightKg: f(81.26)},
	}, nil
}
func (s *fakeStore) SessionLogsSince(context.Context, uuid.UUID, time.Time) ([]progress.SessionLog, error) {
	return []progress.SessionLog{}, nil
}
func (s *fakeStore) AddMeasurement(_ context.Context, _ uuid.UUID, _, _ *float64, decide Decide) ([]AchievedGoal, error) {
	var achieved []AchievedGoal
	for _, g := range s.goals {
		d := decide(g)
		s.decisions = append(s.decisions, d)
		if d.Outcome == goals.Achieve {
			achieved = append(achieved, AchievedGoal{Type: g.Type, Target: g.Target})
		}
	}
	return achieved, nil
}
func (s *fakeStore) DeleteMeasurement(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.deleted, nil
}
func (s *fakeStore) Goals(context.Context, uuid.UUID) ([]Goal, error) { return s.goals, nil }
func (s *fakeStore) GoalValues(context.Context, uuid.UUID, string) (Values, error) {
	return s.values, nil
}
func (s *fakeStore) CreateGoal(_ context.Context, _ uuid.UUID, g Goal) error {
	s.created = append(s.created, g)
	return nil
}
func (s *fakeStore) AbandonGoal(context.Context, uuid.UUID, uuid.UUID) (bool, error) {
	return s.abandoned, nil
}

func service(store *fakeStore) *Service { return NewService(store, func() time.Time { return now }) }

func wantInvalid(t *testing.T, err error, message string) {
	t.Helper()
	var appErr *apperr.Error
	if !errors.As(err, &appErr) || appErr.Message != message {
		t.Fatalf("err = %v, want %q", err, message)
	}
}

func TestValidateBody(t *testing.T) {
	out, err := ValidateBody(BodyInput{BirthDate: " 1994-05-01 ", Sex: "female", HeightCm: f(170), TrainingHistory: "  ", Country: " Iran "}, now)
	if err != nil || *out.BirthDate != "1994-05-01" || *out.Sex != "female" || *out.HeightCm != 170 || out.TrainingHistory != nil || *out.Country != "Iran" {
		t.Fatalf("ValidateBody = %+v, %v", out, err)
	}
	cases := []struct {
		in   BodyInput
		want string
	}{
		{BodyInput{BirthDate: "2020-01-01"}, "Enter a valid birth date"},
		{BodyInput{BirthDate: "1890-01-01"}, "Enter a valid birth date"},
		{BodyInput{BirthDate: "05/01/1994"}, "Enter a valid birth date"},
		{BodyInput{Sex: "x"}, "Invalid sex value"},
		{BodyInput{HeightCm: f(99)}, "Height (cm) must be between 100 and 250"},
	}
	for _, c := range cases {
		_, err := ValidateBody(c.in, now)
		wantInvalid(t, err, c.want)
	}
	long := make([]rune, 80)
	for i := range long {
		long[i] = 'é'
	}
	out, _ = ValidateBody(BodyInput{Country: string(long)}, now)
	if n := len([]rune(*out.Country)); n != MaxCountryLength {
		t.Errorf("country kept %d runes", n)
	}
}

func TestSharingAndOverview(t *testing.T) {
	store := &fakeStore{}
	msg, _ := service(store).SetNutritionSharing(context.Background(), user, true)
	if msg != "Your coach can now see your nutrition." || !*store.sharing {
		t.Errorf("sharing on: %q", msg)
	}
	overview, _ := service(store).Overview(context.Background(), user)
	if overview.WorkoutCount != 4 || overview.RecentXP[0].Label != "Running workout" {
		t.Errorf("overview = %+v", overview)
	}
}

func TestProgressWeightSeries(t *testing.T) {
	p, err := service(&fakeStore{}).Progress(context.Background(), user)
	if err != nil || len(p.Weight) != 3 || p.Weight[0].Label != "Sep 10" || p.Weight[0].Value != 81.3 || p.Weight[2].Value != 79.5 ||
		len(p.WeeklyVolume) != progress.DefaultWeeks {
		t.Fatalf("progress = %+v, %v", p, err)
	}
}

func TestAddMeasurement(t *testing.T) {
	svc := service(&fakeStore{})
	_, err := svc.AddMeasurement(context.Background(), user, nil, nil)
	wantInvalid(t, err, "Enter a weight or a body fat percentage")
	_, err = svc.AddMeasurement(context.Background(), user, f(301), nil)
	wantInvalid(t, err, "Weight (kg) must be between 30 and 300")
	_, err = svc.AddMeasurement(context.Background(), user, nil, f(2.5))
	wantInvalid(t, err, "Body fat (%) must be between 3 and 60")

	store := &fakeStore{goals: []Goal{
		{Type: goals.Weight, Target: 70, Start: f(80)},
		{Type: goals.Weight, Target: 60},                   // no start → baseline
		{Type: goals.BodyFatPct, Target: 15, Start: f(20)}, // no reading → keep
	}}
	logged, err := service(store).AddMeasurement(context.Background(), user, f(69.5), nil)
	if err != nil || logged.Message != "Goal achieved: Weight 70kg! +200 XP" {
		t.Fatalf("logged = %+v, %v", logged, err)
	}
	want := []Decision{{goals.Achieve, 69.5}, {goals.SetBaseline, 69.5}, {goals.Keep, 0}}
	for i, d := range store.decisions {
		if d != want[i] {
			t.Errorf("decision %d = %+v, want %+v", i, d, want[i])
		}
	}
	logged, _ = service(&fakeStore{}).AddMeasurement(context.Background(), user, nil, f(18))
	if logged.Message != "Measurement logged." {
		t.Errorf("plain log = %q", logged.Message)
	}
}

func TestGoals(t *testing.T) {
	store := &fakeStore{
		goals: []Goal{
			{Type: goals.Weight, Target: 70, Start: f(80), Status: "active"},
			{Type: goals.WeeklyRunKm, Target: 20, Status: "active"},
			{Type: goals.BodyFatPct, Target: 15, Status: "achieved"},
			{Type: goals.Weight, Target: 75, Status: "achieved"},
			{Type: goals.Weight, Target: 78, Status: "achieved"},
			{Type: goals.Weight, Target: 79, Status: "achieved"},
			{Type: goals.CalorieIntake, Target: 2000, Status: "abandoned"},
		},
		values: Values{WeightKg: f(75), TodayKcal: f(900)},
	}
	page, err := service(store).Goals(context.Background(), user)
	if err != nil || len(page.Active) != 2 || len(page.Achieved) != AchievedShown {
		t.Fatalf("page = %+v, %v", page, err)
	}
	if p := page.Active[0].Progress; p == nil || p.Pct != 50 || p.Direction != goals.Down {
		t.Errorf("weight progress = %+v", p)
	}
	if page.Active[1].Progress != nil || page.Active[1].Current != nil {
		t.Errorf("run goal should be untracked: %+v", page.Active[1])
	}
}

func TestCreateGoal(t *testing.T) {
	store := &fakeStore{values: Values{WeightKg: f(82), TodayKcal: f(500)}}
	svc := service(store)
	for _, c := range []struct {
		in   GoalInput
		want string
	}{
		{GoalInput{Type: "height", Target: 1}, "Pick a goal type"},
		{GoalInput{Type: "weight", Target: 0}, "Target must be a positive number"},
		{GoalInput{Type: "weight", Target: 70, TargetDate: "soon"}, "Enter a valid target date"},
	} {
		_, err := svc.CreateGoal(context.Background(), user, c.in)
		wantInvalid(t, err, c.want)
	}
	msg, err := svc.CreateGoal(context.Background(), user, GoalInput{Type: "weight", Target: 70, TargetDate: "2026-12-31"})
	if err != nil || msg != "Goal created." || *store.created[0].Start != 82 || *store.created[0].TargetDate != "2026-12-31" {
		t.Fatalf("create = %q %v %+v", msg, err, store.created)
	}
	_, _ = svc.CreateGoal(context.Background(), user, GoalInput{Type: "calorie_intake", Target: 2000})
	if store.created[1].Start != nil {
		t.Errorf("calorie goal got a start: %v", *store.created[1].Start)
	}
	if got := DuplicateGoalMessage(goals.BodyFatPct); got != "You already have an active body fat goal" {
		t.Errorf("duplicate = %q", got)
	}
}

func TestNotFound(t *testing.T) {
	svc := service(&fakeStore{})
	_, err := svc.DeleteMeasurement(context.Background(), user, uuid.New())
	wantInvalid(t, err, "Measurement not found")
	_, err = svc.AbandonGoal(context.Background(), user, uuid.New())
	wantInvalid(t, err, "Goal not found")
}
