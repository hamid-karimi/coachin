package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/coaching"
)

// CoachingService is the coach hub use cases.
type CoachingService interface {
	Hub(ctx context.Context, coachID uuid.UUID) (coaching.Hub, error)
	Summary(ctx context.Context, coachID uuid.UUID) (coaching.Summary, error)
	GenerateInviteCode(ctx context.Context, coachID uuid.UUID, sportTypeID int64) (string, error)
	Join(ctx context.Context, userID uuid.UUID, code string) (coaching.Joined, error)
	AssignWeeklyPlan(ctx context.Context, coachID, traineeID uuid.UUID) (string, error)
}

// TraineeNutritionService is the coach's read-only trainee nutrition view.
type TraineeNutritionService interface {
	TraineeNutrition(ctx context.Context, coachID, traineeID uuid.UUID) (coaching.TraineeNutrition, error)
}

// TraineeMealBody is one logged meal.
type TraineeMealBody struct {
	ID       uuid.UUID `json:"id"`
	MealType string    `json:"mealType"`
	Label    string    `json:"label"`
	Kcal     float64   `json:"kcal"`
	ProteinG float64   `json:"proteinG"`
}

// TraineeDayBody is one of the trainee's days with meals.
type TraineeDayBody struct {
	Date          string            `json:"date" format:"date"`
	Meals         []TraineeMealBody `json:"meals" doc:"Logging order"`
	TotalKcal     float64           `json:"totalKcal"`
	TotalProteinG float64           `json:"totalProteinG"`
}

// MealTargetsBody are the active meal plan's targets.
type MealTargetsBody struct {
	Kcal     float64 `json:"kcal"`
	ProteinG float64 `json:"proteinG"`
}

// TraineeSupplementBody is a stack entry with its last-7-days rate.
type TraineeSupplementBody struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Dose          *string   `json:"dose"`
	ScheduleLabel string    `json:"scheduleLabel"`
	TakenDueDays  int       `json:"takenDueDays"`
	TotalDueDays  int       `json:"totalDueDays"`
}

// TraineeNutritionBody is the coach's view of a trainee's last 7 days.
type TraineeNutritionBody struct {
	TraineeID      uuid.UUID               `json:"traineeId"`
	Name           string                  `json:"name"`
	SharingEnabled bool                    `json:"sharingEnabled" doc:"False: nothing else is read or returned"`
	Days           []TraineeDayBody        `json:"days" doc:"Days with meals, newest first"`
	Targets        *MealTargetsBody        `json:"targets,omitempty" doc:"The active meal plan's daily targets"`
	Supplements    []TraineeSupplementBody `json:"supplements"`
}

type traineeNutritionOutput struct {
	Body TraineeNutritionBody
}

func traineeNutritionBody(n coaching.TraineeNutrition) TraineeNutritionBody {
	body := TraineeNutritionBody{
		TraineeID: n.TraineeID, Name: n.Name, SharingEnabled: n.SharingEnabled,
		Days: make([]TraineeDayBody, len(n.Days)), Supplements: make([]TraineeSupplementBody, len(n.Supplements)),
	}
	for i, d := range n.Days {
		body.Days[i] = TraineeDayBody{Date: d.Date, Meals: make([]TraineeMealBody, len(d.Meals)), TotalKcal: d.TotalKcal, TotalProteinG: d.TotalProteinG}
		for j, m := range d.Meals {
			body.Days[i].Meals[j] = TraineeMealBody{ID: m.ID, MealType: m.MealType, Label: m.Label, Kcal: m.Kcal, ProteinG: m.ProteinG}
		}
	}
	if t := n.Targets; t != nil {
		body.Targets = &MealTargetsBody{Kcal: t.Kcal, ProteinG: t.ProteinG}
	}
	for i, s := range n.Supplements {
		body.Supplements[i] = TraineeSupplementBody{
			ID: s.ID, Name: s.Name, Dose: s.Dose, ScheduleLabel: s.Label, TakenDueDays: s.TakenDueDays, TotalDueDays: s.TotalDueDays,
		}
	}
	return body
}

// SportRefBody is a sport type reference.
type SportRefBody struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// WeekDotBody is one day of a trainee's week strip.
type WeekDotBody struct {
	Date    string `json:"date" format:"date"`
	Weekday int    `json:"weekday" minimum:"0" maximum:"6"`
	State   string `json:"state" enum:"done,missed,planned_today,planned,rest"`
}

// PlanAdherenceBody is an active plan's current-week adherence.
type PlanAdherenceBody struct {
	PlanID       uuid.UUID `json:"planId"`
	Kind         string    `json:"kind" doc:"race (running) or hypertrophy (strength)"`
	AdherencePct float64   `json:"adherencePct"`
}

// TraineeBody is a roster entry.
type TraineeBody struct {
	ID              uuid.UUID           `json:"id"`
	Name            string              `json:"name" doc:"Full name, else email"`
	Email           string              `json:"email"`
	AvatarURL       *string             `json:"avatarUrl"`
	Level           int64               `json:"level"`
	XP              int64               `json:"xp"`
	Tier            string              `json:"tier"`
	Sport           *SportRefBody       `json:"sport,omitempty"`
	WeeklyXP        int64               `json:"weeklyXp"`
	Week            []WeekDotBody       `json:"week" doc:"Monday first"`
	DoneCount       int                 `json:"doneCount" doc:"Days with a completed log this week"`
	ScheduledCount  int                 `json:"scheduledCount" doc:"Routine days per week"`
	Plans           []PlanAdherenceBody `json:"plans"`
	NutritionShared bool                `json:"nutritionShared"`
}

// InviteCodeBody is one of the coach's codes.
type InviteCodeBody struct {
	Code      string        `json:"code"`
	IsActive  bool          `json:"isActive"`
	ExpiresAt *time.Time    `json:"expiresAt"`
	Sport     *SportRefBody `json:"sport,omitempty"`
}

// CoachingHubBody is the coach hub.
type CoachingHubBody struct {
	WeekStart   string           `json:"weekStart" format:"date"`
	Trainees    []TraineeBody    `json:"trainees" doc:"Roster order (joined first)"`
	InviteCodes []InviteCodeBody `json:"inviteCodes"`
}

type coachingHubOutput struct {
	Body CoachingHubBody
}

// CoachingSummaryBody is the dashboard coaching card.
type CoachingSummaryBody struct {
	TraineeCount    int `json:"traineeCount"`
	TrainedThisWeek int `json:"trainedThisWeek"`
}

type coachingSummaryOutput struct {
	Body CoachingSummaryBody
}

type inviteCodeInput struct {
	Body struct {
		SportTypeID int64 `json:"sportTypeId"`
	}
}

// InviteCodeCreatedBody is the new code.
type InviteCodeCreatedBody struct {
	ResultBody
	Code string `json:"code"`
}

type inviteCodeCreatedOutput struct {
	Body InviteCodeCreatedBody
}

type joinCoachInput struct {
	Body struct {
		Code string `json:"code" maxLength:"64"`
	}
}

func traineeBody(t coaching.Trainee) TraineeBody {
	body := TraineeBody{
		ID: t.ID, Email: deref(t.Email), AvatarURL: t.AvatarURL, Level: t.Level, XP: t.XP, Tier: deref(t.LeagueTier),
		WeeklyXP: t.WeeklyXP, Week: make([]WeekDotBody, len(t.Week)), DoneCount: t.DoneCount, ScheduledCount: t.ScheduledCount,
		Plans: make([]PlanAdherenceBody, len(t.Plans)), NutritionShared: t.NutritionShared,
	}
	body.Name = deref(t.FullName)
	if body.Name == "" {
		body.Name = body.Email
	}
	if body.Tier == "" {
		body.Tier = "bronze"
	}
	if t.Sport != nil {
		body.Sport = &SportRefBody{ID: t.Sport.ID, Name: t.Sport.Name}
	}
	for i, d := range t.Week {
		body.Week[i] = WeekDotBody{Date: d.Date, Weekday: d.Weekday, State: string(d.State)}
	}
	for i, p := range t.Plans {
		body.Plans[i] = PlanAdherenceBody(p)
	}
	return body
}

func registerCoaching(api huma.API, deps Deps) {
	svc, logger := deps.Coaching, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	tags := []string{"coaching"}

	huma.Register(api, huma.Operation{
		OperationID: "getCoachingHub", Method: http.MethodGet, Path: "/coaching",
		Summary:     "The coach hub: trainees with this week's adherence, weekly XP, invite codes",
		Description: "Coaches only (role coach, both, or admin); 403 otherwise.",
		Tags:        tags, Middlewares: signedIn, Errors: []int{401, 403},
	}, func(ctx context.Context, _ *struct{}) (*coachingHubOutput, error) {
		userID, _ := userFrom(ctx)
		hub, err := svc.Hub(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := CoachingHubBody{WeekStart: hub.WeekStart, Trainees: make([]TraineeBody, len(hub.Trainees)), InviteCodes: make([]InviteCodeBody, len(hub.InviteCodes))}
		for i, t := range hub.Trainees {
			body.Trainees[i] = traineeBody(t)
		}
		for i, c := range hub.InviteCodes {
			body.InviteCodes[i] = InviteCodeBody{Code: c.Code, IsActive: c.IsActive, ExpiresAt: c.ExpiresAt}
			if c.Sport != nil {
				body.InviteCodes[i].Sport = &SportRefBody{ID: c.Sport.ID, Name: c.Sport.Name}
			}
		}
		return &coachingHubOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getCoachingSummary", Method: http.MethodGet, Path: "/coaching/summary",
		Summary: "Trainee count and how many trained this week (dashboard card)", Tags: tags,
		Middlewares: signedIn, Errors: []int{401, 403},
	}, func(ctx context.Context, _ *struct{}) (*coachingSummaryOutput, error) {
		userID, _ := userFrom(ctx)
		sum, err := svc.Summary(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &coachingSummaryOutput{Body: CoachingSummaryBody(sum)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "createInviteCode", Method: http.MethodPost, Path: "/coaching/invite-codes",
		Summary: "Generate (or replace) your invite code for a sport", Tags: tags,
		DefaultStatus: http.StatusCreated, Middlewares: signedIn, Errors: []int{400, 401, 403},
	}, func(ctx context.Context, in *inviteCodeInput) (*inviteCodeCreatedOutput, error) {
		userID, _ := userFrom(ctx)
		code, err := svc.GenerateInviteCode(ctx, userID, in.Body.SportTypeID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &inviteCodeCreatedOutput{Body: InviteCodeCreatedBody{
			ResultBody: ResultBody{Status: "success", Message: "New invite code generated: " + code}, Code: code,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "joinCoach", Method: http.MethodPost, Path: "/coaching/join",
		Summary: "Connect to a coach with their invite code", Tags: tags,
		Middlewares: huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 5))},
		Errors:      []int{400, 401, 403, 429},
	}, func(ctx context.Context, in *joinCoachInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		joined, err := svc.Join(ctx, userID, in.Body.Code)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: joined.Status, Message: joined.Message}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getTraineeNutrition", Method: http.MethodGet, Path: "/coaching/trainees/{id}/nutrition",
		Summary:     "A coached trainee's last 7 days of meals and supplements (read-only)",
		Description: "Only for an active coaching relationship (404 otherwise), and only with the trainee's nutrition-sharing opt-in.",
		Tags:        tags, Middlewares: signedIn, Errors: []int{401, 403, 404},
	}, func(ctx context.Context, in *idPathInput) (*traineeNutritionOutput, error) {
		userID, _ := userFrom(ctx)
		n, err := deps.TraineeNutrition.TraineeNutrition(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &traineeNutritionOutput{Body: traineeNutritionBody(n)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "assignWeeklyPlan", Method: http.MethodPost, Path: "/coaching/trainees/{id}/weekly-plan",
		Summary:     "Replace the trainee's weekly routine with yours",
		Description: "Needs an active coaching relationship and a routine of your own.",
		Tags:        tags, Middlewares: signedIn, Errors: []int{400, 401, 403},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		msg, err := svc.AssignWeeklyPlan(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: msg}}, nil
	})
}

// deref is the string or "".
func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
