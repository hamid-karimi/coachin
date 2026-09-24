package httpapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
)

// TodayService is the daily-surface use cases.
type TodayService interface {
	Today(ctx context.Context, userID uuid.UUID) (today.Day, error)
	LogWorkout(ctx context.Context, userID uuid.UUID, sportTypeID int64) (today.LoggedWorkout, error)
}

// PlanItemService toggles plan items.
type PlanItemService interface {
	SetPlanItemCompleted(ctx context.Context, userID, itemID uuid.UUID, completed bool) (int, error)
}

// StatsBody is the header's gamification state.
type StatsBody struct {
	XP            int64  `json:"xp"`
	Level         int64  `json:"level"`
	CurrentXP     int64  `json:"currentXp" doc:"XP into the current level"`
	NextLevelXP   int64  `json:"nextLevelXp"`
	CurrentStreak int    `json:"currentStreak"`
	BestStreak    int    `json:"bestStreak"`
	Hearts        int    `json:"hearts" minimum:"0" maximum:"3"`
	Tier          string `json:"tier" enum:"bronze,silver,gold,platinum"`
}

// TodaySessionBody is a fixed session scheduled today.
type TodaySessionBody struct {
	ScheduleID  uuid.UUID `json:"scheduleId"`
	SportTypeID *int64    `json:"sportTypeId"`
	SportName   *string   `json:"sportName"`
	Time        *string   `json:"time" doc:"HH:MM"`
	Multiplier  float64   `json:"multiplier"`
	EstimatedXP int64     `json:"estimatedXp"`
	Completed   bool      `json:"completed" doc:"The sport has a log today"`
}

// TodayPlanItemBody is a plan item on today's list.
type TodayPlanItemBody struct {
	PlanItemBody
	PlanID uuid.UUID `json:"planId"`
	Week   int       `json:"week"`
	Date   string    `json:"date" format:"date"`
}

// ProgressPhotoBody drives the progress-photo nudge.
type ProgressPhotoBody struct {
	Due       bool `json:"due"`
	HasPhotos bool `json:"hasPhotos"`
}

// TodayBody is the Today page.
type TodayBody struct {
	Date          string              `json:"date" format:"date"`
	Weekday       int                 `json:"weekday" minimum:"0" maximum:"6"`
	Stats         StatsBody           `json:"stats"`
	Sessions      []TodaySessionBody  `json:"sessions"`
	PlanItems     []TodayPlanItemBody `json:"planItems" doc:"Today's items across every active plan"`
	ActivePlans   int                 `json:"activePlans"`
	PlanWeek      int                 `json:"planWeek" doc:"Week of the first plan covering today; 0 when none"`
	HardCollision bool                `json:"hardCollision" doc:"2+ run/strength sessions today"`
	DoneCount     int                 `json:"doneCount"`
	TotalCount    int                 `json:"totalCount" doc:"Sessions + plan items with a done toggle"`
	Quotas        []QuotaBody         `json:"quotas"`
	ProgressPhoto ProgressPhotoBody   `json:"progressPhoto"`
}

type todayOutput struct {
	Body TodayBody
}

type logWorkoutInput struct {
	Body struct {
		SportTypeID int64 `json:"sportTypeId"`
	}
}

// WorkoutLoggedBody is the reward after logging a workout.
type WorkoutLoggedBody struct {
	ResultBody
	EarnedXP   int64   `json:"earnedXp"`
	Multiplier float64 `json:"multiplier"`
	TotalXP    int64   `json:"totalXp"`
}

type workoutLoggedOutput struct {
	Body WorkoutLoggedBody
}

type planItemCompletionInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Completed bool `json:"completed"`
	}
}

// PlanItemCompletionBody is the outcome of a done/undo toggle.
type PlanItemCompletionBody struct {
	Status    string `json:"status" enum:"success,info"`
	Message   string `json:"message" doc:"Empty when nothing changed"`
	AwardedXP int    `json:"awardedXp" doc:"Positive on completion, negative on undo, 0 otherwise"`
}

type planItemCompletionOutput struct {
	Body PlanItemCompletionBody
}

func todayBody(day today.Day) TodayBody {
	st := day.Stats
	body := TodayBody{
		Date: day.Date, Weekday: day.Weekday,
		Stats: StatsBody{
			XP: st.XP, Level: st.Level, CurrentXP: st.LevelProgress.CurrentXP, NextLevelXP: st.LevelProgress.NextLevelXP,
			CurrentStreak: st.CurrentStreak, BestStreak: st.BestStreak, Hearts: st.Hearts, Tier: string(st.Tier),
		},
		Sessions:      make([]TodaySessionBody, len(day.Sessions)),
		PlanItems:     make([]TodayPlanItemBody, len(day.PlanItems)),
		ActivePlans:   day.ActivePlans,
		PlanWeek:      day.PlanWeek,
		HardCollision: day.HardCollision,
		DoneCount:     day.DoneCount,
		TotalCount:    day.TotalCount,
		Quotas:        make([]QuotaBody, len(day.Quotas)),
		ProgressPhoto: ProgressPhotoBody{Due: day.ProgressPhotoDue, HasPhotos: day.HasProgressPhoto},
	}
	for i, s := range day.Sessions {
		body.Sessions[i] = TodaySessionBody{
			ScheduleID: s.ScheduleID, SportTypeID: s.SportTypeID, SportName: s.SportName, Time: s.Time,
			Multiplier: s.Multiplier, EstimatedXP: s.EstimatedXP, Completed: s.Completed,
		}
	}
	for i, item := range day.PlanItems {
		body.PlanItems[i] = TodayPlanItemBody{PlanItemBody: planItemBody(item.PlanItem), PlanID: item.PlanID, Week: item.Week, Date: item.Date}
	}
	for i, q := range day.Quotas {
		body.Quotas[i] = QuotaBody{
			ID: q.ID, SportTypeID: q.SportTypeID, SportName: q.SportName, SessionsPerWeek: q.SessionsPerWeek, DoneThisWeek: q.DoneThisWeek,
		}
	}
	return body
}

// completionFeedback is the legacy toast for a toggle's XP delta.
func completionFeedback(awarded int) PlanItemCompletionBody {
	switch {
	case awarded > 0:
		return PlanItemCompletionBody{Status: "success", Message: fmt.Sprintf("+%d XP earned", awarded), AwardedXP: awarded}
	case awarded < 0:
		return PlanItemCompletionBody{Status: "info", Message: fmt.Sprintf("Undone · %d XP", awarded), AwardedXP: awarded}
	default:
		return PlanItemCompletionBody{Status: "success"}
	}
}

func registerToday(api huma.API, deps Deps) {
	days, items, logger := deps.Today, deps.PlanItems, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}

	huma.Register(api, huma.Operation{
		OperationID: "getToday", Method: http.MethodGet, Path: "/today",
		Summary:     "Today: stats, today's sessions and plan items, weekly targets",
		Description: "Settles the streak for every past day first (idempotent).",
		Tags:        []string{"today"}, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*todayOutput, error) {
		userID, _ := userFrom(ctx)
		day, err := days.Today(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &todayOutput{Body: todayBody(day)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "logWorkout", Method: http.MethodPost, Path: "/today/workouts",
		Summary: "Log today's workout for a sport and earn its XP (once per sport per day)",
		Tags:    []string{"today"}, DefaultStatus: http.StatusCreated, Middlewares: signedIn, Errors: []int{400, 401, 409},
	}, func(ctx context.Context, in *logWorkoutInput) (*workoutLoggedOutput, error) {
		userID, _ := userFrom(ctx)
		logged, err := days.LogWorkout(ctx, userID, in.Body.SportTypeID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &workoutLoggedOutput{Body: WorkoutLoggedBody{
			ResultBody: ResultBody{Status: "success", Message: fmt.Sprintf("+%d XP earned", logged.EarnedXP)},
			EarnedXP:   logged.EarnedXP, Multiplier: logged.Multiplier, TotalXP: logged.TotalXP,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setPlanItemCompletion", Method: http.MethodPut, Path: "/plan-items/{id}/completion",
		Summary:     "Mark a plan item done or not done",
		Description: "Done only on the item's day or the day after; undo any time. XP is awarded once and compensated on undo.",
		Tags:        []string{"training"}, Middlewares: signedIn, Errors: []int{400, 401, 404},
	}, func(ctx context.Context, in *planItemCompletionInput) (*planItemCompletionOutput, error) {
		userID, _ := userFrom(ctx)
		awarded, err := items.SetPlanItemCompleted(ctx, userID, in.ID, in.Body.Completed)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &planItemCompletionOutput{Body: completionFeedback(awarded)}, nil
	})
}
