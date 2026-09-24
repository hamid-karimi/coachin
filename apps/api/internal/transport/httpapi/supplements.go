package httpapi

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/supplements"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/today"
)

// SupplementService is the daily-stack mutations.
type SupplementService interface {
	Add(ctx context.Context, userID uuid.UUID, in supplements.AddInput) (string, error)
	Reschedule(ctx context.Context, userID, id uuid.UUID, scheduleType string, days []int) error
	Remove(ctx context.Context, userID, id uuid.UUID) error
	SetTaken(ctx context.Context, userID, id uuid.UUID, taken bool) error
}

// SupplementBody is one stack entry with today's state.
type SupplementBody struct {
	ID            uuid.UUID `json:"id"`
	Name          string    `json:"name"`
	Dose          *string   `json:"dose"`
	ScheduleType  string    `json:"scheduleType" enum:"daily,training_days,custom"`
	DaysOfWeek    []int     `json:"daysOfWeek" doc:"Custom schedules only (0=Sunday … 6=Saturday); empty otherwise"`
	ScheduleLabel string    `json:"scheduleLabel" doc:"e.g. \"Every day\", \"Training days\", \"Mon · Wed\""`
	DueToday      bool      `json:"dueToday"`
	TakenToday    bool      `json:"takenToday"`
}

func supplementBody(s today.Supplement) SupplementBody {
	days := s.Schedule.DaysOfWeek
	if days == nil {
		days = []int{}
	}
	return SupplementBody{
		ID: s.ID, Name: s.Name, Dose: s.Dose, ScheduleType: string(s.Schedule.ScheduleType), DaysOfWeek: days,
		ScheduleLabel: s.Label, DueToday: s.Due, TakenToday: s.Taken,
	}
}

// SupplementScheduleFields is a submitted due-day schedule; unknown types
// fall back to daily.
type SupplementScheduleFields struct {
	ScheduleType string `json:"scheduleType,omitempty" enum:"daily,training_days,custom" default:"daily"`
	DaysOfWeek   []int  `json:"daysOfWeek,omitempty" maxItems:"7" doc:"Custom schedules only"`
}

type addSupplementInput struct {
	Body struct {
		Name string `json:"name" maxLength:"200"`
		Dose string `json:"dose,omitempty" maxLength:"200"`
		SupplementScheduleFields
	}
}

type rescheduleInput struct {
	ID   uuid.UUID `path:"id"`
	Body SupplementScheduleFields
}

type takenInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		Taken bool `json:"taken"`
	}
}

func registerSupplements(api huma.API, deps Deps) {
	svc, logger := deps.Supplements, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	tags := []string{"supplements"}
	result := func(status, message string) *resultOutput {
		return &resultOutput{Body: ResultBody{Status: status, Message: message}}
	}

	huma.Register(api, huma.Operation{
		OperationID: "addSupplement", Method: http.MethodPost, Path: "/supplements",
		Summary: "Add a supplement to the daily stack (max 20)", Tags: tags,
		DefaultStatus: http.StatusCreated, Middlewares: signedIn, Errors: []int{400, 401},
	}, func(ctx context.Context, in *addSupplementInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		name, err := svc.Add(ctx, userID, supplements.AddInput{Name: b.Name, Dose: b.Dose, ScheduleType: b.ScheduleType, DaysOfWeek: b.DaysOfWeek})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("success", name+" added to your daily stack."), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "rescheduleSupplement", Method: http.MethodPut, Path: "/supplements/{id}/schedule",
		Summary: "Change when a supplement is due", Tags: tags, Middlewares: signedIn, Errors: []int{401, 404},
	}, func(ctx context.Context, in *rescheduleInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		if err := svc.Reschedule(ctx, userID, in.ID, in.Body.ScheduleType, in.Body.DaysOfWeek); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("info", "Schedule updated."), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "removeSupplement", Method: http.MethodDelete, Path: "/supplements/{id}",
		Summary: "Remove a supplement and its logs", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		if err := svc.Remove(ctx, userID, in.ID); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("info", "Removed."), nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "setSupplementTaken", Method: http.MethodPut, Path: "/supplements/{id}/taken",
		Summary: "Check today's dose off (or back on); no XP", Tags: tags, Middlewares: signedIn, Errors: []int{401, 404},
	}, func(ctx context.Context, in *takenInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		if err := svc.SetTaken(ctx, userID, in.ID, in.Body.Taken); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return result("success", ""), nil
	})
}
