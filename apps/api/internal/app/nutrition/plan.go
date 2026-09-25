package nutrition

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/profile"
)

// PlanIntake is the meal-plan wizard's answers, stored with the plan (legacy
// JSON keys) so it can be regenerated.
type PlanIntake struct {
	Goal        string   `json:"goal"`
	Diet        string   `json:"diet"`
	Allergies   []string `json:"allergies"`
	Dislikes    []string `json:"dislikes"`
	MealsPerDay int      `json:"meals_per_day"`
}

// PlanProfile is the body data targets are sized from.
type PlanProfile struct {
	Sex       *string
	BirthDate *string // YYYY-MM-DD
	HeightCm  *float64
	WeightKg  *float64
	Country   *string
}

// MealPlanItem is a stored planned meal.
type MealPlanItem struct {
	ID uuid.UUID
	aigen.PlannedMeal
}

// MealPlan is the active plan.
type MealPlan struct {
	ID      uuid.UUID
	Targets nutrition.Targets
	Intake  PlanIntake
	Items   []MealPlanItem
}

// NewMealPlan is a generated plan to store.
type NewMealPlan struct {
	Intake  PlanIntake
	Targets nutrition.Targets
	Meals   []aigen.PlannedMeal
}

// PlanStore is the persistence meal plans need; every call runs as the user.
type PlanStore interface {
	PlanProfile(ctx context.Context, userID uuid.UUID) (PlanProfile, error)
	// TrainingDaysPerWeek counts distinct weekdays with a fixed session.
	TrainingDaysPerWeek(ctx context.Context, userID uuid.UUID) (int, error)
	// BodyAnalysis is the newest analyzed body photo's analysis, nil without one.
	BodyAnalysis(ctx context.Context, userID uuid.UUID) (json.RawMessage, error)
	HasActiveTrainingPlan(ctx context.Context, userID uuid.UUID) (bool, error)
	// ActiveMealPlan returns nil without an active plan.
	ActiveMealPlan(ctx context.Context, userID uuid.UUID) (*MealPlan, error)
	// SaveMealPlan archives the active plan, stores this one, and points the
	// calorie-intake goal at its target, in one transaction.
	SaveMealPlan(ctx context.Context, userID uuid.UUID, plan NewMealPlan) error
	ArchiveMealPlan(ctx context.Context, userID uuid.UUID) error
}

// Plans runs the AI meal plan. now is injectable for tests.
type Plans struct {
	store PlanStore
	ai    AI
	now   func() time.Time
}

// NewPlans builds the service; now defaults to time.Now.
func NewPlans(store PlanStore, ai AI, now func() time.Time) *Plans {
	if now == nil {
		now = time.Now
	}
	return &Plans{store: store, ai: ai, now: now}
}

// PlanPage is /nutrition/plan: the active plan with its grocery list, or the
// wizard (which suggests a training plan first when there is none).
type PlanPage struct {
	Plan            *MealPlan
	Grocery         []nutrition.GroceryLine
	HasTrainingPlan bool
}

// Page loads the active plan.
func (p *Plans) Page(ctx context.Context, userID uuid.UUID) (PlanPage, error) {
	plan, err := p.store.ActiveMealPlan(ctx, userID)
	if err != nil {
		return PlanPage{}, fmt.Errorf("load meal plan: %w", err)
	}
	hasTraining, err := p.store.HasActiveTrainingPlan(ctx, userID)
	if err != nil {
		return PlanPage{}, fmt.Errorf("load training plan: %w", err)
	}
	page := PlanPage{Plan: plan, HasTrainingPlan: hasTraining, Grocery: []nutrition.GroceryLine{}}
	if plan != nil {
		items := make([]nutrition.PlanItem, len(plan.Items))
		for i, item := range plan.Items {
			items[i] = nutrition.PlanItem{Ingredients: item.Ingredients}
		}
		page.Grocery = nutrition.BuildGroceryList(items)
	}
	return page, nil
}

var planGoals = map[string]bool{"lose": true, "maintain": true, "gain": true, "recomp": true}

// List limits: at most 20 entries of 60 characters each.
const (
	maxListEntries = 20
	maxListEntry   = 60
	maxDietLength  = 40
)

// cleanList trims entries, drops blanks, and caps the list.
func cleanList(entries []string) []string {
	out := []string{}
	for _, entry := range entries {
		if e := jsnum.Slice(strings.TrimSpace(entry), maxListEntry); e != "" && len(out) < maxListEntries {
			out = append(out, e)
		}
	}
	return out
}

// Generate sizes daily targets from the profile and training days, asks the AI
// for a 7-day menu, replaces the active plan, and sets the calorie goal to
// the plan's target.
func (p *Plans) Generate(ctx context.Context, userID uuid.UUID, in PlanIntake) (string, error) {
	if !planGoals[in.Goal] {
		return "", apperr.New(apperr.Invalid, "Pick a goal")
	}
	intake := PlanIntake{
		Goal: in.Goal, Diet: jsnum.Slice(strings.TrimSpace(in.Diet), maxDietLength),
		Allergies: cleanList(in.Allergies), Dislikes: cleanList(in.Dislikes), MealsPerDay: 3,
	}
	if intake.Diet == "" {
		intake.Diet = "omnivore"
	}
	if in.MealsPerDay == 4 {
		intake.MealsPerDay = 4
	}

	targets, athlete, err := p.targets(ctx, userID, nutrition.Goal(intake.Goal))
	if err != nil {
		return "", err
	}
	result, ok := p.ai.GenerateJSON(ctx, aigen.MealPlanRequest(aigen.MealPlanIntake{
		Goal: intake.Goal, Diet: intake.Diet, Allergies: intake.Allergies, Dislikes: intake.Dislikes,
		MealsPerDay: intake.MealsPerDay, Targets: targets, BodyAnalysis: athlete.analysis, Country: athlete.country,
	}))
	if !ok {
		return "", apperr.New(apperr.Unavailable, aigen.ErrMealPlanUnavailable.Error())
	}
	meals, err := aigen.ParseMealPlan(result.Text)
	if err != nil {
		return "", apperr.New(apperr.Unavailable, err.Error())
	}
	if len(meals) == 0 {
		return "", apperr.New(apperr.Unavailable, "Couldn't generate a plan — try again.")
	}
	if err := p.store.SaveMealPlan(ctx, userID, NewMealPlan{Intake: intake, Targets: targets, Meals: meals}); err != nil {
		return "", fmt.Errorf("save meal plan: %w", err)
	}
	return "Meal plan ready — your calorie goal is set to match.", nil
}

// athleteContext is the optional prompt context.
type athleteContext struct {
	analysis *string
	country  *string
}

func (p *Plans) targets(ctx context.Context, userID uuid.UUID, goal nutrition.Goal) (nutrition.Targets, athleteContext, error) {
	var athlete athleteContext
	prof, err := p.store.PlanProfile(ctx, userID)
	if err != nil {
		return nutrition.Targets{}, athlete, fmt.Errorf("load profile: %w", err)
	}
	days, err := p.store.TrainingDaysPerWeek(ctx, userID)
	if err != nil {
		return nutrition.Targets{}, athlete, fmt.Errorf("load schedules: %w", err)
	}
	if days == 0 {
		days = 3
	}
	in := nutrition.TargetInputs{Sex: prof.Sex, HeightCm: prof.HeightCm, WeightKg: prof.WeightKg, TrainingDaysPerWeek: float64(days), Goal: goal}
	if prof.BirthDate != nil {
		if years, ok := dates.YearsSince(*prof.BirthDate, p.now()); ok {
			age := float64(years)
			in.Age = &age
		}
	}
	targets, ok := nutrition.ComputeTargets(in)
	if !ok {
		return nutrition.Targets{}, athlete, apperr.New(apperr.Invalid, "Add your height, weight, and birth date on your profile so we can size your targets.")
	}
	raw, err := p.store.BodyAnalysis(ctx, userID)
	if err != nil {
		return nutrition.Targets{}, athlete, fmt.Errorf("load body analysis: %w", err)
	}
	athlete.analysis = analysisSummary(raw)
	if c, ok := profile.ResolveCountry(prof.Country, nil); ok {
		athlete.country = &c
	}
	return targets, athlete, nil
}

// analysisSummary is "<build notes> <posture notes>" (500 chars), nil when empty.
func analysisSummary(raw json.RawMessage) *string {
	var a struct {
		BuildNotes   string `json:"build_notes"`
		PostureNotes string `json:"posture_notes"`
	}
	if len(raw) == 0 || json.Unmarshal(raw, &a) != nil {
		return nil
	}
	parts := []string{}
	for _, note := range []string{a.BuildNotes, a.PostureNotes} {
		if note != "" {
			parts = append(parts, note)
		}
	}
	summary := jsnum.Slice(strings.Join(parts, " "), 500)
	if summary == "" {
		return nil
	}
	return &summary
}

// Regenerate re-runs the active plan's stored intake.
func (p *Plans) Regenerate(ctx context.Context, userID uuid.UUID) (string, error) {
	plan, err := p.store.ActiveMealPlan(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("load meal plan: %w", err)
	}
	if plan == nil {
		return "", apperr.New(apperr.NotFound, "No meal plan to regenerate")
	}
	return p.Generate(ctx, userID, plan.Intake)
}

// Discard archives the active plan; the calorie goal stays.
func (p *Plans) Discard(ctx context.Context, userID uuid.UUID) (string, error) {
	if err := p.store.ArchiveMealPlan(ctx, userID); err != nil {
		return "", fmt.Errorf("discard meal plan: %w", err)
	}
	return "Meal plan discarded.", nil
}
