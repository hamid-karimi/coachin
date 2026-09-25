package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/progress"
)

// ProfileService is the profile tab use cases.
type ProfileService interface {
	Body(ctx context.Context, userID uuid.UUID) (profile.Body, error)
	UpdateBody(ctx context.Context, userID uuid.UUID, in profile.BodyInput) (string, error)
	SetNutritionSharing(ctx context.Context, userID uuid.UUID, enabled bool) (string, error)
	Overview(ctx context.Context, userID uuid.UUID) (profile.Overview, error)
	Progress(ctx context.Context, userID uuid.UUID) (profile.Progress, error)
	AddMeasurement(ctx context.Context, userID uuid.UUID, weightKg, bodyFatPct *float64) (profile.Logged, error)
	DeleteMeasurement(ctx context.Context, userID, id uuid.UUID) (string, error)
	Goals(ctx context.Context, userID uuid.UUID) (profile.GoalsPage, error)
	CreateGoal(ctx context.Context, userID uuid.UUID, in profile.GoalInput) (string, error)
	AbandonGoal(ctx context.Context, userID, id uuid.UUID) (string, error)
}

// BodyProfileBody is the Body tab's form and the Settings tab's toggle.
type BodyProfileBody struct {
	BirthDate        *string  `json:"birthDate" format:"date"`
	Sex              *string  `json:"sex" enum:"male,female,other"`
	HeightCm         *float64 `json:"heightCm"`
	TrainingHistory  *string  `json:"trainingHistory"`
	Country          *string  `json:"country"`
	WeightKg         *float64 `json:"weightKg" doc:"Snapshot of the latest weight measurement"`
	BodyFatPct       *float64 `json:"bodyFatPct" doc:"Snapshot of the latest body-fat measurement"`
	NutritionSharing bool     `json:"nutritionSharing" doc:"The active coach may read meal logs and the meal plan"`
}

type bodyProfileOutput struct {
	Body BodyProfileBody
}

type updateBodyInput struct {
	Body struct {
		BirthDate       string   `json:"birthDate,omitempty" doc:"YYYY-MM-DD; blank clears"`
		Sex             string   `json:"sex,omitempty" doc:"male, female, other; blank clears"`
		HeightCm        *float64 `json:"heightCm,omitempty" doc:"100–250; absent clears"`
		TrainingHistory string   `json:"trainingHistory,omitempty" maxLength:"5000"`
		Country         string   `json:"country,omitempty" maxLength:"200"`
	}
}

type sharingInput struct {
	Body struct {
		Enabled bool `json:"enabled"`
	}
}

// XPEntryBody is a "Recent XP" line.
type XPEntryBody struct {
	ID        uuid.UUID `json:"id"`
	Amount    int       `json:"amount"`
	Label     string    `json:"label" doc:"e.g. \"Running workout\", \"Streak bonus\""`
	CreatedAt time.Time `json:"createdAt"`
}

// ProfileOverviewBody is the Overview tab (stats come from GET /today).
type ProfileOverviewBody struct {
	JoinedAt     time.Time     `json:"joinedAt"`
	AvatarURL    *string       `json:"avatarUrl"`
	WorkoutCount int           `json:"workoutCount" doc:"Completed workout logs"`
	RecentXP     []XPEntryBody `json:"recentXp" doc:"The 5 newest ledger rows"`
}

type profileOverviewOutput struct {
	Body ProfileOverviewBody
}

// MeasurementBody is one body measurement.
type MeasurementBody struct {
	ID         uuid.UUID `json:"id"`
	MeasuredAt string    `json:"measuredAt" format:"date"`
	WeightKg   *float64  `json:"weightKg"`
	BodyFatPct *float64  `json:"bodyFatPct"`
}

// ProfileProgressBody is the Progress tab: charts (FORMULAS §15) and the last
// 6 measurements.
type ProfileProgressBody struct {
	Measurements []MeasurementBody        `json:"measurements"`
	WeeklyVolume []progress.ChartPoint    `json:"weeklyVolume" doc:"8 weeks of strength volume (kg), oldest first"`
	WeeklyKm     []progress.ChartPoint    `json:"weeklyKm" doc:"8 weeks of running distance"`
	Weight       []progress.ChartPoint    `json:"weight" doc:"Body weight from the measurements shown"`
	TopSets      []progress.ExerciseTrend `json:"topSets" doc:"Heaviest set per day for up to 3 exercises logged on 3+ days"`
}

type profileProgressOutput struct {
	Body ProfileProgressBody
}

type measurementInput struct {
	Body struct {
		WeightKg   *float64 `json:"weightKg,omitempty" doc:"30–300"`
		BodyFatPct *float64 `json:"bodyFatPct,omitempty" doc:"3–60"`
	}
}

// MeasurementLoggedBody is the outcome of logging a measurement.
type MeasurementLoggedBody struct {
	ResultBody
	AchievedGoals []string `json:"achievedGoals" doc:"Goals this reading achieved (+200 XP each), e.g. \"Weight 70kg\""`
}

type measurementLoggedOutput struct {
	Body MeasurementLoggedBody
}

// GoalProgressBody is movement from start toward target (FORMULAS §6).
type GoalProgressBody struct {
	Pct       float64 `json:"pct" minimum:"0" maximum:"100"`
	Direction string  `json:"direction" enum:"up,down"`
	Achieved  bool    `json:"achieved"`
}

// GoalBody is one goal.
type GoalBody struct {
	ID         uuid.UUID  `json:"id"`
	GoalType   string     `json:"goalType" enum:"weight,body_fat_pct,calorie_intake,calories_burned,weekly_run_km,monthly_run_km"`
	Target     float64    `json:"target"`
	Start      *float64   `json:"start"`
	TargetDate *string    `json:"targetDate" format:"date"`
	AchievedAt *time.Time `json:"achievedAt"`
}

// ActiveGoalBody is an active goal with its metric's current value.
type ActiveGoalBody struct {
	GoalBody
	Current  *float64          `json:"current" doc:"Null while the metric isn't tracked yet"`
	Progress *GoalProgressBody `json:"progress,omitempty"`
}

// GoalsBody is the goals section.
type GoalsBody struct {
	Active   []ActiveGoalBody `json:"active" doc:"Newest first"`
	Achieved []GoalBody       `json:"achieved" doc:"The 3 most recent"`
}

type goalsOutput struct {
	Body GoalsBody
}

type createGoalInput struct {
	Body struct {
		GoalType   string  `json:"goalType" maxLength:"40"`
		Target     float64 `json:"target"`
		TargetDate string  `json:"targetDate,omitempty" doc:"YYYY-MM-DD"`
	}
}

func goalBody(g profile.Goal) GoalBody {
	return GoalBody{ID: g.ID, GoalType: string(g.Type), Target: g.Target, Start: g.Start, TargetDate: g.TargetDate, AchievedAt: g.AchievedAt}
}

func goalsBody(page profile.GoalsPage) GoalsBody {
	body := GoalsBody{Active: make([]ActiveGoalBody, len(page.Active)), Achieved: make([]GoalBody, len(page.Achieved))}
	for i, g := range page.Active {
		body.Active[i] = ActiveGoalBody{GoalBody: goalBody(g.Goal), Current: g.Current}
		if p := g.Progress; p != nil {
			body.Active[i].Progress = &GoalProgressBody{Pct: p.Pct, Direction: string(p.Direction), Achieved: p.Achieved}
		}
	}
	for i, g := range page.Achieved {
		body.Achieved[i] = goalBody(g)
	}
	return body
}

func progressBody(p profile.Progress) ProfileProgressBody {
	body := ProfileProgressBody{
		Measurements: make([]MeasurementBody, len(p.Measurements)),
		WeeklyVolume: p.WeeklyVolume, WeeklyKm: p.WeeklyKm, Weight: p.Weight, TopSets: p.TopSets,
	}
	for i, m := range p.Measurements {
		body.Measurements[i] = MeasurementBody(m)
	}
	return body
}

func registerProfile(api huma.API, deps Deps) {
	svc, logger := deps.Profile, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	tags := []string{"profile"}
	result := func(status, message string) *resultOutput {
		return &resultOutput{Body: ResultBody{Status: status, Message: message}}
	}

	huma.Register(api, huma.Operation{
		OperationID: "getBodyProfile", Method: http.MethodGet, Path: "/me/body",
		Summary: "The body profile, measurement snapshot, and nutrition sharing", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*bodyProfileOutput, error) {
		userID, _ := userFrom(ctx)
		b, err := svc.Body(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &bodyProfileOutput{Body: BodyProfileBody(b)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "updateBodyProfile", Method: http.MethodPut, Path: "/me/body",
		Summary: "Save the body profile (birth date, sex, height, training history, country)", Tags: tags,
		Middlewares: signedIn, Errors: []int{400, 401},
	}, func(ctx context.Context, in *updateBodyInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		msg, err := svc.UpdateBody(ctx, userID, profile.BodyInput{
			BirthDate: b.BirthDate, Sex: b.Sex, HeightCm: b.HeightCm, TrainingHistory: b.TrainingHistory, Country: b.Country,
		})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("success", msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setNutritionSharing", Method: http.MethodPut, Path: "/me/nutrition-sharing",
		Summary: "Let the active coach see meal logs and the meal plan (or revoke it)", Tags: tags,
		Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, in *sharingInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.SetNutritionSharing(ctx, userID, in.Body.Enabled)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result(map[bool]string{true: "success", false: "info"}[in.Body.Enabled], msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getProfileOverview", Method: http.MethodGet, Path: "/me/overview",
		Summary: "Profile overview: join date, workout count, recent XP", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*profileOverviewOutput, error) {
		userID, _ := userFrom(ctx)
		o, err := svc.Overview(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := ProfileOverviewBody{JoinedAt: o.JoinedAt, AvatarURL: o.AvatarURL, WorkoutCount: o.WorkoutCount, RecentXP: make([]XPEntryBody, len(o.RecentXP))}
		for i, e := range o.RecentXP {
			body.RecentXP[i] = XPEntryBody(e)
		}
		return &profileOverviewOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getProfileProgress", Method: http.MethodGet, Path: "/me/progress",
		Summary: "Progress charts and recent measurements", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*profileProgressOutput, error) {
		userID, _ := userFrom(ctx)
		p, err := svc.Progress(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &profileProgressOutput{Body: progressBody(p)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "addMeasurement", Method: http.MethodPost, Path: "/measurements",
		Summary:     "Log weight and/or body fat",
		Description: "Refreshes the profile snapshot and settles weight / body-fat goals (+200 XP each) in one transaction.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Middlewares: signedIn, Errors: []int{400, 401},
	}, func(ctx context.Context, in *measurementInput) (*measurementLoggedOutput, error) {
		userID, _ := userFrom(ctx)
		logged, err := svc.AddMeasurement(ctx, userID, in.Body.WeightKg, in.Body.BodyFatPct)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &measurementLoggedOutput{Body: MeasurementLoggedBody{
			ResultBody: ResultBody{Status: "success", Message: logged.Message}, AchievedGoals: logged.Achieved,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deleteMeasurement", Method: http.MethodDelete, Path: "/measurements/{id}",
		Summary: "Delete a measurement", Tags: tags, Middlewares: signedIn, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.DeleteMeasurement(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("success", msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "listGoals", Method: http.MethodGet, Path: "/goals",
		Summary: "Active goals with progress and the 3 most recently achieved", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*goalsOutput, error) {
		userID, _ := userFrom(ctx)
		page, err := svc.Goals(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &goalsOutput{Body: goalsBody(page)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "createGoal", Method: http.MethodPost, Path: "/goals",
		Summary:     "Set a goal (one active per type)",
		Description: "Weight and body-fat goals start from the latest reading, so direction (lose vs gain) is fixed from day one.",
		Tags:        tags, DefaultStatus: http.StatusCreated, Middlewares: signedIn, Errors: []int{400, 401, 409},
	}, func(ctx context.Context, in *createGoalInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		msg, err := svc.CreateGoal(ctx, userID, profile.GoalInput{Type: b.GoalType, Target: b.Target, TargetDate: b.TargetDate})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("success", msg), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "abandonGoal", Method: http.MethodPost, Path: "/goals/{id}/abandon",
		Summary: "Stop tracking an active goal (no XP)", Tags: tags, Middlewares: signedIn, Errors: []int{401, 404},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.AbandonGoal(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("info", msg), nil
	})
}
