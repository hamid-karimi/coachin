package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
)

// GenerationService is plan generation.
type GenerationService interface {
	Intake(ctx context.Context, userID uuid.UUID, student *uuid.UUID) (training.IntakeContext, error)
	GenerateRunning(ctx context.Context, userID uuid.UUID, in training.RunningInput) (training.Created, error)
	GenerateHypertrophy(ctx context.Context, userID uuid.UUID, in training.HypertrophyInput) (training.Created, error)
}

// IntakeContextBody is the wizard's header: whose plan and their profile.
type IntakeContextBody struct {
	ForStudent      bool     `json:"forStudent" doc:"Coach mode: generating for a trainee"`
	AthleteName     string   `json:"athleteName" doc:"The trainee's name in coach mode; empty otherwise"`
	Age             *int     `json:"age"`
	Sex             *string  `json:"sex"`
	HeightCm        *float64 `json:"heightCm"`
	WeightKg        *float64 `json:"weightKg"`
	TrainingHistory *string  `json:"trainingHistory"`
}

type intakeContextInput struct {
	Student string `query:"student" doc:"Coach mode: the trainee's id"`
}

type intakeContextOutput struct {
	Body IntakeContextBody
}

// PlanCreatedBody is a generated, saved plan.
type PlanCreatedBody struct {
	ResultBody
	PlanID     uuid.UUID `json:"planId"`
	ForStudent bool      `json:"forStudent"`
}

type planCreatedOutput struct {
	Body PlanCreatedBody
}

type runningPlanInput struct {
	Body struct {
		Mode             string     `json:"mode" enum:"base,race"`
		RaceTarget       string     `json:"raceTarget,omitempty" maxLength:"10" doc:"5k, 10k, half, full, ultra, other"`
		CustomDistanceKm *float64   `json:"customDistanceKm,omitempty" doc:"ultra/other only"`
		RaceDate         string     `json:"raceDate,omitempty" maxLength:"10"`
		GoalTime         string     `json:"goalTime,omitempty" maxLength:"20"`
		ExperienceLevel  string     `json:"experienceLevel,omitempty" maxLength:"20"`
		DaysPerWeek      int        `json:"daysPerWeek"`
		BaseWeeks        *float64   `json:"baseWeeks,omitempty"`
		PB5k             string     `json:"pb5k,omitempty" maxLength:"20"`
		PB10k            string     `json:"pb10k,omitempty" maxLength:"20"`
		PBHalf           string     `json:"pbHalf,omitempty" maxLength:"20"`
		PBFull           string     `json:"pbFull,omitempty" maxLength:"20"`
		WeeklyKm         *float64   `json:"weeklyKm,omitempty"`
		LongestRunKm     *float64   `json:"longestRunKm,omitempty"`
		Injuries         string     `json:"injuries,omitempty" maxLength:"500"`
		Activities       []any      `json:"activities,omitempty" maxItems:"20" doc:"Parsed watch-file summaries"`
		TargetStudentID  *uuid.UUID `json:"targetStudentId,omitempty" doc:"Coach mode"`
	}
}

type hypertrophyPlanInput struct {
	Body struct {
		Goal            string     `json:"goal" enum:"muscle_gain,recomp"`
		Equipment       string     `json:"equipment" enum:"gym,home,bodyweight"`
		DaysPerWeek     int        `json:"daysPerWeek"`
		WeeksTotal      int        `json:"weeksTotal"`
		ExperienceLevel string     `json:"experienceLevel,omitempty" maxLength:"20"`
		Injuries        string     `json:"injuries,omitempty" maxLength:"500"`
		TargetStudentID *uuid.UUID `json:"targetStudentId,omitempty" doc:"Coach mode"`
	}
}

func planCreated(created training.Created) *planCreatedOutput {
	return &planCreatedOutput{Body: PlanCreatedBody{
		ResultBody: ResultBody{Status: "success", Message: "Your plan is ready."},
		PlanID:     created.PlanID, ForStudent: created.ForStudent,
	}}
}

func registerGeneration(api huma.API, deps Deps) {
	svc, logger := deps.Generation, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	// Generation calls paid AI providers: a few per minute per address.
	generating := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(20*time.Second, 3))}
	tags := []string{"training"}

	huma.Register(api, huma.Operation{
		OperationID: "getIntakeContext", Method: http.MethodGet, Path: "/training/intake-context",
		Summary: "Whose plan the wizard builds, and their body profile", Tags: tags,
		Middlewares: signedIn, Errors: []int{401, 403},
	}, func(ctx context.Context, in *intakeContextInput) (*intakeContextOutput, error) {
		userID, _ := userFrom(ctx)
		var student *uuid.UUID
		if id, err := uuid.Parse(in.Student); err == nil {
			student = &id
		}
		intake, err := svc.Intake(ctx, userID, student)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &intakeContextOutput{Body: IntakeContextBody{
			ForStudent: intake.ForStudent, AthleteName: intake.AthleteName, Age: intake.Age, Sex: intake.Sex,
			HeightCm: intake.HeightCm, WeightKg: intake.WeightKg, TrainingHistory: intake.TrainingHistory,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "generateRunningPlan", Method: http.MethodPost, Path: "/training/plans/running",
		Summary:     "Generate a running plan (base-building or race) with AI and save it",
		Description: "Replaces the athlete's active running plan. Takes ~15-60 s.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Middlewares: generating, Errors: []int{400, 401, 403, 429, 502},
	}, func(ctx context.Context, in *runningPlanInput) (*planCreatedOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		var activities any
		if b.Activities != nil {
			activities = b.Activities
		}
		created, err := svc.GenerateRunning(ctx, userID, training.RunningInput{
			Mode: b.Mode, RaceTarget: b.RaceTarget, CustomDistanceKm: b.CustomDistanceKm, RaceDate: b.RaceDate,
			GoalTime: b.GoalTime, ExperienceLevel: b.ExperienceLevel, DaysPerWeek: b.DaysPerWeek, BaseWeeks: b.BaseWeeks,
			PB5k: b.PB5k, PB10k: b.PB10k, PBHalf: b.PBHalf, PBFull: b.PBFull, WeeklyKm: b.WeeklyKm,
			LongestRunKm: b.LongestRunKm, Injuries: b.Injuries, Activities: activities, TargetStudentID: b.TargetStudentID,
		})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return planCreated(created), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "generateHypertrophyPlan", Method: http.MethodPost, Path: "/training/plans/hypertrophy",
		Summary:     "Generate a muscle-building plan with AI and save it",
		Description: "Replaces the athlete's active hypertrophy plan. Takes ~15-60 s.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Middlewares: generating, Errors: []int{400, 401, 403, 429, 502},
	}, func(ctx context.Context, in *hypertrophyPlanInput) (*planCreatedOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		created, err := svc.GenerateHypertrophy(ctx, userID, training.HypertrophyInput{
			Goal: b.Goal, Equipment: b.Equipment, DaysPerWeek: b.DaysPerWeek, WeeksTotal: b.WeeksTotal,
			ExperienceLevel: b.ExperienceLevel, Injuries: b.Injuries, TargetStudentID: b.TargetStudentID,
		})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return planCreated(created), nil
	})
}
