package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
)

// SessionLogService is "how did it go" logging.
type SessionLogService interface {
	LogSession(ctx context.Context, userID uuid.UUID, in training.SessionInput) (training.SessionLogged, error)
}

// SessionFeedbackBody is the AI coach's comment on a logged session.
type SessionFeedbackBody struct {
	Message string `json:"message"`
	Flag    string `json:"flag" enum:"ok,caution,red"`
}

// SessionLoggedBody is the log outcome.
type SessionLoggedBody struct {
	ResultBody
	AwardedXP     int                  `json:"awardedXp"`
	Feedback      *SessionFeedbackBody `json:"feedback,omitempty" doc:"Absent when the AI is unavailable and nothing was flagged"`
	TotalVolumeKg float64              `json:"totalVolumeKg" doc:"Strength: Σ weight × reps; 0 for runs"`
}

type sessionLoggedOutput struct {
	Body SessionLoggedBody
}

type logSessionInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Sport       string   `json:"sport" enum:"run,strength"`
		RPE         *int     `json:"rpe,omitempty" doc:"Perceived effort 1–10"`
		Note        string   `json:"note,omitempty" maxLength:"2000"`
		DistanceKm  *float64 `json:"distanceKm,omitempty"`
		DurationMin *float64 `json:"durationMin,omitempty"`
		AvgHR       *float64 `json:"avgHr,omitempty"`
		Exercises   []any    `json:"exercises,omitempty" maxItems:"30" doc:"Strength: [{name, sets: [{reps, weight_kg}]}]"`
	}
}

func registerSessionLogs(api huma.API, deps Deps) {
	svc, logger := deps.Sessions, deps.logger()
	// Each log asks the AI for feedback: rate-limited like the other AI calls.
	logging := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 6))}

	huma.Register(api, huma.Operation{
		OperationID: "logSession", Method: http.MethodPost, Path: "/plan-items/{id}/session-log",
		Summary:     "Log how a run or strength session went",
		Description: "Marks the item done, awards +10 XP once, and adds AI coach feedback (never fails the log).",
		Tags:        []string{"training"}, DefaultStatus: http.StatusCreated, Middlewares: logging,
		Errors: []int{400, 401, 404, 409, 429},
	}, func(ctx context.Context, in *logSessionInput) (*sessionLoggedOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		var exercises any
		if b.Exercises != nil {
			exercises = b.Exercises
		}
		logged, err := svc.LogSession(ctx, userID, training.SessionInput{
			PlanItemID: in.ID, Sport: b.Sport, RPE: b.RPE, Note: b.Note,
			DistanceKm: b.DistanceKm, DurationMin: b.DurationMin, AvgHR: b.AvgHR, Exercises: exercises,
		})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := SessionLoggedBody{
			ResultBody: ResultBody{Status: "success", Message: logged.Message},
			AwardedXP:  logged.AwardedXP, TotalVolumeKg: logged.TotalVolumeKg,
		}
		if f := logged.Feedback; f != nil {
			body.Feedback = &SessionFeedbackBody{Message: f.Message, Flag: string(f.Flag)}
		}
		return &sessionLoggedOutput{Body: body}, nil
	})
}
