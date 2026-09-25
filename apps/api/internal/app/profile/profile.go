// Package profile is the profile use cases: the body profile and settings,
// body measurements (which settle measurement goals), goals, and the
// overview / progress reads.
package profile

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/goals"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/progress"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
)

// Limits (legacy country cap; the history cap is new).
const (
	MaxCountryLength = 56
	MaxHistoryLength = 2000
	RecentXPCount    = 5
	MeasurementCount = 6
	AchievedShown    = 3
	ChartWeeks       = 12 // session logs read for the charts
	GoalXP           = 200
)

// Body is the static body profile plus the measurement snapshot and settings.
type Body struct {
	BirthDate        *string
	Sex              *string
	HeightCm         *float64
	TrainingHistory  *string
	Country          *string
	WeightKg         *float64
	BodyFatPct       *float64
	NutritionSharing bool
}

// BodyUpdate is a validated body profile; nil clears a field.
type BodyUpdate struct {
	BirthDate, Sex, TrainingHistory, Country *string
	HeightCm                                 *float64
}

// BodyInput is the body profile as submitted; blanks clear.
type BodyInput struct {
	BirthDate, Sex, TrainingHistory, Country string
	HeightCm                                 *float64
}

// Measurement is one body measurement.
type Measurement struct {
	ID         uuid.UUID
	MeasuredAt string
	WeightKg   *float64
	BodyFatPct *float64
}

// Goal is one goal row.
type Goal struct {
	ID         uuid.UUID
	Type       goals.Type
	Target     float64
	Start      *float64
	TargetDate *string
	Status     string
	AchievedAt *time.Time
	CreatedAt  time.Time
}

// ActiveGoal is an active goal with its metric's current value.
type ActiveGoal struct {
	Goal
	Current  *float64
	Progress *goals.Progress
}

// GoalsPage is the goals section.
type GoalsPage struct {
	Active   []ActiveGoal
	Achieved []Goal
}

// Values are the current value of each trackable metric (nil when unknown).
type Values struct {
	WeightKg, BodyFatPct, TodayKcal *float64
}

func (v Values) of(t goals.Type) *float64 {
	return map[goals.Type]*float64{
		goals.Weight: v.WeightKg, goals.BodyFatPct: v.BodyFatPct, goals.CalorieIntake: v.TodayKcal,
	}[t]
}

// XPRow is a raw ledger row.
type XPRow struct {
	ID        uuid.UUID
	Amount    int
	Reason    *string
	CreatedAt time.Time
}

// OverviewRow is what the store reads for the overview.
type OverviewRow struct {
	JoinedAt     time.Time
	AvatarURL    *string
	WorkoutCount int
	RecentXP     []XPRow
	SportNames   map[int64]string
}

// XPEntry is a "Recent XP" line.
type XPEntry struct {
	ID        uuid.UUID
	Amount    int
	Label     string
	CreatedAt time.Time
}

// Overview is the overview tab (stats come from /today).
type Overview struct {
	JoinedAt     time.Time
	AvatarURL    *string
	WorkoutCount int
	RecentXP     []XPEntry
}

// Progress is the progress tab: charts and recent measurements.
type Progress struct {
	Measurements []Measurement
	WeeklyVolume []progress.ChartPoint
	WeeklyKm     []progress.ChartPoint
	Weight       []progress.ChartPoint
	TopSets      []progress.ExerciseTrend
}

// AchievedGoal is a goal a measurement just settled.
type AchievedGoal struct {
	Type   goals.Type
	Target float64
}

// Decision is what a new measurement does to one active goal; Reading is the
// goal metric's new value (the baseline when Outcome is SetBaseline).
type Decision struct {
	Outcome goals.Settlement
	Reading float64
}

// Decide says what a new measurement does to an active measurement goal.
type Decide func(g Goal) Decision

// Store is the persistence the use cases need; every call is scoped to the user.
type Store interface {
	Body(ctx context.Context, userID uuid.UUID) (Body, error)
	UpdateBody(ctx context.Context, userID uuid.UUID, body BodyUpdate) error
	SetNutritionSharing(ctx context.Context, userID uuid.UUID, enabled bool) error
	Overview(ctx context.Context, userID uuid.UUID, recent int) (OverviewRow, error)
	Measurements(ctx context.Context, userID uuid.UUID, limit int) ([]Measurement, error)
	SessionLogsSince(ctx context.Context, userID uuid.UUID, since time.Time) ([]progress.SessionLog, error)
	// AddMeasurement inserts the reading, refreshes the profile snapshot, and
	// applies decide to every active measurement goal — one transaction.
	AddMeasurement(ctx context.Context, userID uuid.UUID, weightKg, bodyFatPct *float64, decide Decide) ([]AchievedGoal, error)
	// DeleteMeasurement reports false when the row is not the user's.
	DeleteMeasurement(ctx context.Context, userID, id uuid.UUID) (bool, error)
	Goals(ctx context.Context, userID uuid.UUID) ([]Goal, error)
	GoalValues(ctx context.Context, userID uuid.UUID, today string) (Values, error)
	// CreateGoal returns an apperr Conflict when that type is already active.
	CreateGoal(ctx context.Context, userID uuid.UUID, g Goal) error
	// AbandonGoal reports false when no active goal has that id.
	AbandonGoal(ctx context.Context, userID, id uuid.UUID) (bool, error)
}

// Service runs the use cases. now is injectable for tests.
type Service struct {
	store Store
	now   func() time.Time
}

// NewService builds the service; now defaults to time.Now.
func NewService(store Store, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{store: store, now: now}
}

// Body reads the body profile.
func (s *Service) Body(ctx context.Context, userID uuid.UUID) (Body, error) {
	return s.store.Body(ctx, userID)
}

func truncate(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

var sexes = map[string]bool{"male": true, "female": true, "other": true}

// year is legacy's 365.25-day year.
const year = time.Duration(365.25 * 24 * float64(time.Hour))

// ValidateBody checks a submitted body profile (legacy rules).
func ValidateBody(in BodyInput, now time.Time) (BodyUpdate, error) {
	var out BodyUpdate
	if raw := strings.TrimSpace(in.BirthDate); raw != "" {
		born, err := time.Parse(dates.YMDLayout, raw)
		age := float64(now.Sub(born)) / float64(year)
		if err != nil || age < 10 || age > 120 {
			return out, apperr.New(apperr.Invalid, "Enter a valid birth date")
		}
		out.BirthDate = &raw
	}
	sex := strings.TrimSpace(in.Sex)
	if sex != "" && !sexes[sex] {
		return out, apperr.New(apperr.Invalid, "Invalid sex value")
	}
	out.Sex = optional(sex)
	if h := in.HeightCm; h != nil {
		if *h < 100 || *h > 250 {
			return out, apperr.New(apperr.Invalid, "Height (cm) must be between 100 and 250")
		}
		out.HeightCm = h
	}
	out.TrainingHistory = optional(truncate(strings.TrimSpace(in.TrainingHistory), MaxHistoryLength))
	out.Country = optional(truncate(strings.TrimSpace(in.Country), MaxCountryLength))
	return out, nil
}

// UpdateBody saves the body profile.
func (s *Service) UpdateBody(ctx context.Context, userID uuid.UUID, in BodyInput) (string, error) {
	body, err := ValidateBody(in, s.now())
	if err != nil {
		return "", err
	}
	if err := s.store.UpdateBody(ctx, userID, body); err != nil {
		return "", fmt.Errorf("update body profile: %w", err)
	}
	return "Profile updated.", nil
}

// SharingMessage is the toast after flipping nutrition sharing.
var SharingMessage = map[bool]string{
	true:  "Your coach can now see your nutrition.",
	false: "Nutrition sharing turned off.",
}

// SetNutritionSharing flips the coach's read access to the user's meals.
func (s *Service) SetNutritionSharing(ctx context.Context, userID uuid.UUID, enabled bool) (string, error) {
	if err := s.store.SetNutritionSharing(ctx, userID, enabled); err != nil {
		return "", fmt.Errorf("set nutrition sharing: %w", err)
	}
	return SharingMessage[enabled], nil
}

// Overview reads the overview tab.
func (s *Service) Overview(ctx context.Context, userID uuid.UUID) (Overview, error) {
	row, err := s.store.Overview(ctx, userID, RecentXPCount)
	if err != nil {
		return Overview{}, fmt.Errorf("read overview: %w", err)
	}
	out := Overview{JoinedAt: row.JoinedAt, AvatarURL: row.AvatarURL, WorkoutCount: row.WorkoutCount, RecentXP: make([]XPEntry, len(row.RecentXP))}
	for i, r := range row.RecentXP {
		out.RecentXP[i] = XPEntry{ID: r.ID, Amount: r.Amount, Label: xp.ReasonLabel(r.Reason, row.SportNames), CreatedAt: r.CreatedAt}
	}
	return out, nil
}

// Progress reads the progress tab: the last 6 measurements and the charts.
func (s *Service) Progress(ctx context.Context, userID uuid.UUID) (Progress, error) {
	now := s.now()
	measurements, err := s.store.Measurements(ctx, userID, MeasurementCount)
	if err != nil {
		return Progress{}, fmt.Errorf("read measurements: %w", err)
	}
	logs, err := s.store.SessionLogsSince(ctx, userID, now.AddDate(0, 0, -7*ChartWeeks))
	if err != nil {
		return Progress{}, fmt.Errorf("read session logs: %w", err)
	}
	for i := range logs {
		logs[i].CreatedAt = logs[i].CreatedAt.In(now.Location())
	}
	// Oldest first: the series sorts by date only (stable), so same-day
	// readings keep the order they were logged in (legacy reversed them).
	weights := make([]progress.Measurement, len(measurements))
	for i, m := range measurements {
		w := &weights[len(measurements)-1-i]
		*w = progress.Measurement{MeasuredAt: m.MeasuredAt}
		if m.WeightKg != nil {
			w.WeightKg = *m.WeightKg
		}
	}
	return Progress{
		Measurements: measurements,
		WeeklyVolume: progress.WeeklyVolume(logs, now, progress.DefaultWeeks),
		WeeklyKm:     progress.WeeklyKm(logs, now, progress.DefaultWeeks),
		Weight:       progress.WeightSeries(weights, now.Location()),
		TopSets:      progress.ExerciseTopSets(logs, 3, 3, now.Location()),
	}, nil
}

// measurementRange checks an optional reading.
func measurementRange(v *float64, lo, hi float64, label string) error {
	if v != nil && (*v < lo || *v > hi) {
		return apperr.New(apperr.Invalid, fmt.Sprintf("%s must be between %g and %g", label, lo, hi))
	}
	return nil
}

// Logged is a saved measurement's outcome.
type Logged struct {
	Message  string
	Achieved []string // "Weight 70kg"
}

// GoalLabel is "Weight 70kg".
func GoalLabel(t goals.Type, target float64) string {
	meta := goals.TypeMeta[t]
	return fmt.Sprintf("%s %s%s", meta.Label, formatValue(target), meta.Unit)
}

// formatValue prints a number like JS String(n).
func formatValue(v float64) string {
	return strconv.FormatFloat(v, 'f', -1, 64)
}

// AddMeasurement logs weight and/or body fat and settles measurement goals:
// a crossed target pays GoalXP; a goal without a start takes this reading as
// its baseline (FORMULAS §6).
func (s *Service) AddMeasurement(ctx context.Context, userID uuid.UUID, weightKg, bodyFatPct *float64) (Logged, error) {
	if err := measurementRange(weightKg, 30, 300, "Weight (kg)"); err != nil {
		return Logged{}, err
	}
	if err := measurementRange(bodyFatPct, 3, 60, "Body fat (%)"); err != nil {
		return Logged{}, err
	}
	if weightKg == nil && bodyFatPct == nil {
		return Logged{}, apperr.New(apperr.Invalid, "Enter a weight or a body fat percentage")
	}
	reading := Values{WeightKg: weightKg, BodyFatPct: bodyFatPct}
	achieved, err := s.store.AddMeasurement(ctx, userID, weightKg, bodyFatPct, func(g Goal) Decision {
		value := reading.of(g.Type)
		decision := Decision{Outcome: goals.Settle(g.Start, g.Target, value)}
		if value != nil {
			decision.Reading = *value
		}
		return decision
	})
	if err != nil {
		return Logged{}, fmt.Errorf("add measurement: %w", err)
	}
	if len(achieved) == 0 {
		return Logged{Message: "Measurement logged.", Achieved: []string{}}, nil
	}
	labels := make([]string, len(achieved))
	for i, g := range achieved {
		labels[i] = GoalLabel(g.Type, g.Target)
	}
	return Logged{
		Message:  fmt.Sprintf("Goal achieved: %s! +%d XP", strings.Join(labels, ", "), GoalXP*len(achieved)),
		Achieved: labels,
	}, nil
}

// DeleteMeasurement removes one of the user's measurements.
func (s *Service) DeleteMeasurement(ctx context.Context, userID, id uuid.UUID) (string, error) {
	ok, err := s.store.DeleteMeasurement(ctx, userID, id)
	if err != nil {
		return "", fmt.Errorf("delete measurement: %w", err)
	}
	if !ok {
		return "", apperr.New(apperr.NotFound, "Measurement not found")
	}
	return "Measurement deleted.", nil
}

// Goals reads the goals section: active goals with progress (newest first)
// and the 3 most recent achieved.
func (s *Service) Goals(ctx context.Context, userID uuid.UUID) (GoalsPage, error) {
	all, err := s.store.Goals(ctx, userID)
	if err != nil {
		return GoalsPage{}, fmt.Errorf("read goals: %w", err)
	}
	page := GoalsPage{Active: []ActiveGoal{}, Achieved: []Goal{}}
	if !slices.ContainsFunc(all, func(g Goal) bool { return g.Status == "active" }) {
		page.Achieved = achievedOf(all)
		return page, nil
	}
	values, err := s.store.GoalValues(ctx, userID, dates.ToYMD(s.now()))
	if err != nil {
		return GoalsPage{}, fmt.Errorf("read goal values: %w", err)
	}
	for _, g := range all {
		if g.Status != "active" {
			continue
		}
		active := ActiveGoal{Goal: g, Current: values.of(g.Type)}
		if p, ok := goals.ProgressOf(g.Start, g.Target, active.Current); ok {
			active.Progress = &p
		}
		page.Active = append(page.Active, active)
	}
	page.Achieved = achievedOf(all)
	return page, nil
}

func achievedOf(all []Goal) []Goal {
	achieved := []Goal{}
	for _, g := range all {
		if g.Status == "achieved" && len(achieved) < AchievedShown {
			achieved = append(achieved, g)
		}
	}
	return achieved
}

// GoalInput is a new goal as submitted.
type GoalInput struct {
	Type       string
	Target     float64
	TargetDate string
}

// CreateGoal sets a goal. A measurement goal starts from the latest reading,
// so its direction (lose vs gain) is known from day one.
func (s *Service) CreateGoal(ctx context.Context, userID uuid.UUID, in GoalInput) (string, error) {
	t := goals.Type(in.Type)
	if _, ok := goals.TypeMeta[t]; !ok {
		return "", apperr.New(apperr.Invalid, "Pick a goal type")
	}
	if !(in.Target > 0) {
		return "", apperr.New(apperr.Invalid, "Target must be a positive number")
	}
	g := Goal{Type: t, Target: in.Target}
	if raw := strings.TrimSpace(in.TargetDate); raw != "" {
		if _, err := time.Parse(dates.YMDLayout, raw); err != nil {
			return "", apperr.New(apperr.Invalid, "Enter a valid target date")
		}
		g.TargetDate = &raw
	}
	if goals.FromMeasurement(t) {
		values, err := s.store.GoalValues(ctx, userID, dates.ToYMD(s.now()))
		if err != nil {
			return "", fmt.Errorf("read goal values: %w", err)
		}
		g.Start = values.of(t)
	}
	if err := s.store.CreateGoal(ctx, userID, g); err != nil {
		return "", err
	}
	return "Goal created.", nil
}

// DuplicateGoalMessage is the one-active-goal-per-type clash.
func DuplicateGoalMessage(t goals.Type) string {
	return fmt.Sprintf("You already have an active %s goal", strings.ToLower(goals.TypeMeta[t].Label))
}

// AbandonGoal stops tracking an active goal.
func (s *Service) AbandonGoal(ctx context.Context, userID, id uuid.UUID) (string, error) {
	ok, err := s.store.AbandonGoal(ctx, userID, id)
	if err != nil {
		return "", fmt.Errorf("abandon goal: %w", err)
	}
	if !ok {
		return "", apperr.New(apperr.NotFound, "Goal not found")
	}
	return "Goal removed.", nil
}
