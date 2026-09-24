package training

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/activity"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/running"
)

// JSONGenerator produces AI JSON (Claude, falling back to Gemini).
type JSONGenerator interface {
	GenerateJSON(ctx context.Context, req aigen.Request) (aigen.Result, bool)
}

// Athlete is the body profile that personalizes a plan.
type Athlete struct {
	FullName        *string
	Email           *string
	BirthDate       *string
	Sex             *string
	HeightCm        *float64
	WeightKg        *float64
	TrainingHistory *string
}

// NewPlan is a generated plan to save.
type NewPlan struct {
	PlanKind   string // race | hypertrophy
	RaceDate   *string
	GoalTime   *string
	WeeksTotal int
	Summary    string
	Intake     json.RawMessage
	Raw        json.RawMessage
	Model      string
	Items      []aigen.PlanItemInput
	// Target is the trainee a coach generates for; nil = the caller.
	Target *uuid.UUID
}

// GenerationStore is the persistence plan generation needs; every call runs
// as the acting user.
type GenerationStore interface {
	Role(ctx context.Context, userID uuid.UUID) (string, error)
	// Coaches reports an active coaching relationship coach → student.
	Coaches(ctx context.Context, coachID, studentID uuid.UUID) (bool, error)
	Athlete(ctx context.Context, actingID, athleteID uuid.UUID) (Athlete, error)
	// Anchors are the athlete's fixed sessions active on date.
	Anchors(ctx context.Context, actingID, athleteID uuid.UUID, date string) ([]aigen.Anchor, error)
	// CalorieTarget and BodyAnalysis are the athlete's own data: nil when
	// the acting user may not read them (a coach) or there is none.
	CalorieTarget(ctx context.Context, actingID, athleteID uuid.UUID) (*float64, error)
	BodyAnalysis(ctx context.Context, actingID, athleteID uuid.UUID) (*string, error)
	// CreatePlan archives the same-discipline active plan and saves this one.
	CreatePlan(ctx context.Context, actingID uuid.UUID, plan NewPlan) (uuid.UUID, error)
}

// Generation runs plan generation. now is injectable for tests.
type Generation struct {
	store GenerationStore
	ai    JSONGenerator
	now   func() time.Time
}

// NewGeneration builds the service; now defaults to time.Now.
func NewGeneration(store GenerationStore, ai JSONGenerator, now func() time.Time) *Generation {
	if now == nil {
		now = time.Now
	}
	return &Generation{store: store, ai: ai, now: now}
}

// Created is a saved plan and whom it was for.
type Created struct {
	PlanID     uuid.UUID
	ForStudent bool
}

var coachRoles = map[string]bool{"coach": true, "both": true, "admin": true}

// target resolves whom the plan is for: the caller, or a trainee they
// actively coach (re-verified by the create_training_plan function too).
func (g *Generation) target(ctx context.Context, userID uuid.UUID, student *uuid.UUID) (uuid.UUID, bool, error) {
	if student == nil || *student == userID {
		return userID, false, nil
	}
	role, err := g.store.Role(ctx, userID)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("load role: %w", err)
	}
	if !coachRoles[role] {
		return uuid.Nil, false, apperr.New(apperr.Forbidden, "Your current role cannot generate plans for trainees")
	}
	ok, err := g.store.Coaches(ctx, userID, *student)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("check relationship: %w", err)
	}
	if !ok {
		return uuid.Nil, false, apperr.New(apperr.Forbidden, "This trainee is not coached by you")
	}
	return *student, true, nil
}

// IntakeContext is what the wizards show before asking anything: whose plan
// it is and the body profile that will shape it.
type IntakeContext struct {
	ForStudent  bool
	AthleteName string // coach mode only
	Age         *int
	Athlete
}

// Intake resolves the plan's athlete (the caller or a coached trainee) and
// their profile for the wizard.
func (g *Generation) Intake(ctx context.Context, userID uuid.UUID, student *uuid.UUID) (IntakeContext, error) {
	athleteID, forStudent, err := g.target(ctx, userID, student)
	if err != nil {
		return IntakeContext{}, err
	}
	athlete, err := g.store.Athlete(ctx, userID, athleteID)
	if err != nil {
		return IntakeContext{}, fmt.Errorf("load athlete: %w", err)
	}
	out := IntakeContext{ForStudent: forStudent, Age: age(athlete, g.now()), Athlete: athlete}
	if forStudent {
		out.AthleteName = "your trainee"
		for _, name := range []*string{athlete.FullName, athlete.Email} {
			if name != nil && *name != "" {
				out.AthleteName = *name
				break
			}
		}
	}
	return out, nil
}

// RunningInput is the running wizard as submitted.
type RunningInput struct {
	Mode             string // base | race
	RaceTarget       string
	CustomDistanceKm *float64
	RaceDate         string
	GoalTime         string
	ExperienceLevel  string
	DaysPerWeek      int
	BaseWeeks        *float64
	PB5k, PB10k      string
	PBHalf, PBFull   string
	WeeklyKm         *float64
	LongestRunKm     *float64
	Injuries         string
	Activities       any // decoded JSON, sanitized here
	TargetStudentID  *uuid.UUID
}

var (
	experienceLevels = map[string]bool{"new": true, "recreational": true, "regular": true, "competitive": true}
	raceTargets      = map[string]bool{"5k": true, "10k": true, "half": true, "full": true, "ultra": true, "other": true}
)

// optionalTime keeps a time only when it parses ("25:00", "3:59:30").
func optionalTime(value string) *string {
	v := strings.TrimSpace(value)
	if v == "" {
		return nil
	}
	if _, ok := running.ParseTimeToSeconds(v); !ok {
		return nil
	}
	return &v
}

// optionalNumber keeps a finite positive number.
func optionalNumber(v *float64) *float64 {
	if v == nil || math.IsNaN(*v) || math.IsInf(*v, 0) || *v <= 0 {
		return nil
	}
	return v
}

func optionalText(value string) *string {
	if v := strings.TrimSpace(value); v != "" {
		return &v
	}
	return nil
}

var week = 7 * 24 * time.Hour

// GenerateRunning validates the running wizard, generates the plan, and
// saves it (replacing the athlete's active running plan).
func (g *Generation) GenerateRunning(ctx context.Context, userID uuid.UUID, in RunningInput) (Created, error) {
	now := g.now()
	var experience *string
	if e := strings.TrimSpace(in.ExperienceLevel); experienceLevels[e] {
		experience = &e
	}
	intake := aigen.MarathonIntake{PlanKind: "race", ExperienceLevel: experience, Activities: activity.Sanitize(in.Activities)}
	pbs := [4]*string{optionalTime(in.PB5k), optionalTime(in.PB10k), optionalTime(in.PBHalf), optionalTime(in.PBFull)}
	intake.PB5k, intake.PB10k, intake.PBHalf, intake.PBFull = pbs[0], pbs[1], pbs[2], pbs[3]

	if in.Mode == "base" {
		intake.RaceTarget = "base"
		intake.WeeksTotal = running.ClampBaseWeeks(in.BaseWeeks)
		intake.FirstTimeAtDistance = experience != nil && *experience == "new"
	} else {
		target := strings.TrimSpace(in.RaceTarget)
		if !raceTargets[target] {
			return Created{}, apperr.New(apperr.Invalid, "Pick your race distance")
		}
		km, ok := running.RaceDistanceKm(target, optionalNumber(in.CustomDistanceKm))
		if !ok || km < 1 || km > 500 {
			return Created{}, apperr.New(apperr.Invalid, "Enter the race distance in km (1-500)")
		}
		raceDate := strings.TrimSpace(in.RaceDate)
		day, err := time.ParseInLocation(dates.YMDLayout, raceDate, now.Location())
		if err != nil {
			return Created{}, apperr.New(apperr.Invalid, "Pick your race date")
		}
		weeksUntil := int(math.Floor(float64(day.Sub(now)) / float64(week)))
		if weeksUntil < 4 {
			return Created{}, apperr.New(apperr.Invalid, "Race must be at least 4 weeks away for a useful plan")
		}
		intake.RaceTarget, intake.RaceDistanceKm, intake.RaceDate = target, km, &raceDate
		intake.WeeksTotal = min(weeksUntil, 24)
		intake.GoalTime = optionalTime(in.GoalTime)
		// First time at the distance = no PB at or beyond it.
		longest := 0.0
		for i, key := range []string{"pb_5k", "pb_10k", "pb_half", "pb_full"} {
			if pbs[i] != nil {
				longest = running.PBDistancesKm[key]
			}
		}
		intake.FirstTimeAtDistance = longest < km-0.01
	}
	if in.DaysPerWeek < 2 || in.DaysPerWeek > 7 {
		return Created{}, apperr.New(apperr.Invalid, "Pick 2-7 training days per week")
	}
	intake.DaysPerWeek = in.DaysPerWeek
	intake.WeeklyKm, intake.LongestRunKm = optionalNumber(in.WeeklyKm), optionalNumber(in.LongestRunKm)
	intake.Injuries = optionalText(in.Injuries)

	athleteID, forStudent, err := g.target(ctx, userID, in.TargetStudentID)
	if err != nil {
		return Created{}, err
	}
	athlete, err := g.store.Athlete(ctx, userID, athleteID)
	if err != nil {
		return Created{}, fmt.Errorf("load athlete: %w", err)
	}
	intake.Age, intake.Sex, intake.HeightCm, intake.WeightKg, intake.TrainingHistory = age(athlete, now), athlete.Sex, athlete.HeightCm, athlete.WeightKg, athlete.TrainingHistory
	intake.Anchors = g.anchors(ctx, userID, athleteID, now)

	plan, model, err := g.generate(ctx, aigen.MarathonRequest(intake), intake.WeeksTotal)
	if err != nil {
		return Created{}, err
	}
	raw, _ := json.Marshal(intake)
	return g.save(ctx, userID, forStudent, athleteID, NewPlan{
		PlanKind: "race", RaceDate: intake.RaceDate, GoalTime: intake.GoalTime, WeeksTotal: intake.WeeksTotal,
		Summary: plan.Summary, Intake: raw, Raw: plan.Raw, Model: model, Items: plan.Items,
	})
}

// HypertrophyInput is the muscle-building wizard as submitted.
type HypertrophyInput struct {
	Goal            string
	Equipment       string
	DaysPerWeek     int
	WeeksTotal      int
	ExperienceLevel string
	Injuries        string
	TargetStudentID *uuid.UUID
}

var (
	hypertrophyGoals = map[string]bool{"muscle_gain": true, "recomp": true}
	equipmentOptions = map[string]bool{"gym": true, "home": true, "bodyweight": true}
	hypertrophyWeeks = map[int]bool{8: true, 10: true, 12: true}
)

// GenerateHypertrophy validates the strength wizard, generates the plan,
// and saves it (replacing the athlete's active hypertrophy plan).
func (g *Generation) GenerateHypertrophy(ctx context.Context, userID uuid.UUID, in HypertrophyInput) (Created, error) {
	goal, equipment := strings.TrimSpace(in.Goal), strings.TrimSpace(in.Equipment)
	switch {
	case !hypertrophyGoals[goal]:
		return Created{}, apperr.New(apperr.Invalid, "Pick a goal")
	case !equipmentOptions[equipment]:
		return Created{}, apperr.New(apperr.Invalid, "Pick your equipment")
	case in.DaysPerWeek < 2 || in.DaysPerWeek > 6:
		return Created{}, apperr.New(apperr.Invalid, "Pick 2-6 training days per week")
	case !hypertrophyWeeks[in.WeeksTotal]:
		return Created{}, apperr.New(apperr.Invalid, "Pick a plan length")
	}
	athleteID, forStudent, err := g.target(ctx, userID, in.TargetStudentID)
	if err != nil {
		return Created{}, err
	}
	now := g.now()
	athlete, err := g.store.Athlete(ctx, userID, athleteID)
	if err != nil {
		return Created{}, fmt.Errorf("load athlete: %w", err)
	}
	intake := aigen.HypertrophyIntake{
		Goal: goal, ExperienceLevel: optionalText(in.ExperienceLevel), Equipment: equipment,
		DaysPerWeek: in.DaysPerWeek, WeeksTotal: in.WeeksTotal, Injuries: optionalText(in.Injuries),
		Age: age(athlete, now), Sex: athlete.Sex, HeightCm: athlete.HeightCm, WeightKg: athlete.WeightKg,
		TrainingHistory: athlete.TrainingHistory, Anchors: g.anchors(ctx, userID, athleteID, now),
	}
	// Optional hints: never block generation.
	if intake.CalorieTarget, err = g.store.CalorieTarget(ctx, userID, athleteID); err != nil {
		intake.CalorieTarget = nil
	}
	if intake.BodyAnalysis, err = g.store.BodyAnalysis(ctx, userID, athleteID); err != nil {
		intake.BodyAnalysis = nil
	}

	plan, model, err := g.generate(ctx, aigen.HypertrophyRequest(intake), intake.WeeksTotal)
	if err != nil {
		return Created{}, err
	}
	raw, _ := json.Marshal(struct {
		PlanKind string `json:"plan_kind"`
		aigen.HypertrophyIntake
	}{"hypertrophy", intake})
	return g.save(ctx, userID, forStudent, athleteID, NewPlan{
		PlanKind: "hypertrophy", WeeksTotal: intake.WeeksTotal, Summary: plan.Summary,
		Intake: raw, Raw: plan.Raw, Model: model, Items: plan.Items,
	})
}

func age(a Athlete, now time.Time) *int {
	if a.BirthDate == nil {
		return nil
	}
	if years, ok := dates.YearsSince(*a.BirthDate, now); ok {
		return &years
	}
	return nil
}

// anchors are best-effort: a failed read never blocks generation.
func (g *Generation) anchors(ctx context.Context, userID, athleteID uuid.UUID, now time.Time) []aigen.Anchor {
	anchors, err := g.store.Anchors(ctx, userID, athleteID, dates.ToYMD(now))
	if err != nil {
		return []aigen.Anchor{}
	}
	return anchors
}

func (g *Generation) generate(ctx context.Context, req aigen.Request, weeksTotal int) (aigen.GeneratedPlan, string, error) {
	result, ok := g.ai.GenerateJSON(ctx, req)
	if !ok {
		return aigen.GeneratedPlan{}, "", apperr.New(apperr.Unavailable, aigen.ErrUnavailable.Error())
	}
	plan, err := aigen.ParsePlan(result.Text, weeksTotal)
	if errors.Is(err, aigen.ErrIncomplete) {
		return aigen.GeneratedPlan{}, "", apperr.New(apperr.Unavailable, err.Error())
	}
	if err != nil {
		return aigen.GeneratedPlan{}, "", apperr.New(apperr.Unavailable, aigen.ErrUnavailable.Error())
	}
	return plan, result.Model, nil
}

func (g *Generation) save(ctx context.Context, userID uuid.UUID, forStudent bool, athleteID uuid.UUID, plan NewPlan) (Created, error) {
	if forStudent {
		plan.Target = &athleteID
	}
	id, err := g.store.CreatePlan(ctx, userID, plan)
	if err != nil {
		return Created{}, fmt.Errorf("save plan: %w", err)
	}
	return Created{PlanID: id, ForStudent: forStudent}, nil
}
