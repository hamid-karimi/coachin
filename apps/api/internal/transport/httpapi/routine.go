package httpapi

import (
	"context"
	"fmt"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/routine"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/xp"
)

// RoutineService is the "My week" use cases.
type RoutineService interface {
	SportTypes(ctx context.Context) ([]routine.SportType, error)
	Week(ctx context.Context, userID uuid.UUID) (routine.Week, error)
	AddSchedules(ctx context.Context, userID uuid.UUID, in routine.AddSchedulesInput) (int, error)
	DeleteSchedule(ctx context.Context, userID, id uuid.UUID) error
	SaveQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64, sessionsPerWeek int) error
	DeleteQuota(ctx context.Context, userID uuid.UUID, sportTypeID int64) error
}

// SportTypeBody is a selectable sport.
type SportTypeBody struct {
	ID           int64   `json:"id"`
	Name         string  `json:"name"`
	XPMultiplier float64 `json:"xpMultiplier" doc:"Effective multiplier (unset counts as 1)"`
}

// ScheduleBody is one fixed weekly session.
type ScheduleBody struct {
	ID          uuid.UUID `json:"id"`
	SportTypeID *int64    `json:"sportTypeId"`
	SportName   *string   `json:"sportName"`
	DayOfWeek   int       `json:"dayOfWeek" minimum:"0" maximum:"6" doc:"0=Sunday … 6=Saturday"`
	Time        *string   `json:"time" doc:"HH:MM"`
	EndsOn      *string   `json:"endsOn" format:"date"`
}

// QuotaBody is one weekly target with this week's progress.
type QuotaBody struct {
	ID              uuid.UUID `json:"id"`
	SportTypeID     int64     `json:"sportTypeId"`
	SportName       *string   `json:"sportName"`
	SessionsPerWeek int       `json:"sessionsPerWeek"`
	DoneThisWeek    int       `json:"doneThisWeek" doc:"Distinct days this Mon–Sun week with a completed log of the sport"`
}

// PlanItemDetailsBody are the display fields of an AI plan item.
type PlanItemDetailsBody struct {
	DistanceKm  *float64 `json:"distanceKm,omitempty"`
	PaceMinKm   *string  `json:"paceMinKm,omitempty"`
	DurationMin *float64 `json:"durationMin,omitempty"`
	Notes       *string  `json:"notes,omitempty"`
	VideoQuery  *string  `json:"videoQuery,omitempty"`
}

// PlanItemBody is one AI plan session.
type PlanItemBody struct {
	ID          uuid.UUID           `json:"id"`
	DayOfWeek   int                 `json:"dayOfWeek" minimum:"0" maximum:"6"`
	ItemType    string              `json:"itemType"`
	Title       string              `json:"title"`
	Description *string             `json:"description"`
	IsCompleted bool                `json:"isCompleted"`
	Details     PlanItemDetailsBody `json:"details"`
}

// RoutineBody is the "My week" page.
type RoutineBody struct {
	Schedules         []ScheduleBody `json:"schedules"`
	Quotas            []QuotaBody    `json:"quotas"`
	PlanItems         []PlanItemBody `json:"planItems" doc:"Current week of the newest active AI plan (read-only here)"`
	EstimatedWeeklyXP int64          `json:"estimatedWeeklyXp"`
}

type sportTypesOutput struct {
	Body []SportTypeBody
}

type routineOutput struct {
	Body RoutineBody
}

type addSchedulesInput struct {
	Body struct {
		SportTypeID int64  `json:"sportTypeId"`
		Days        []int  `json:"days" maxItems:"7" doc:"0=Sunday … 6=Saturday"`
		Time        string `json:"time,omitempty" maxLength:"8" doc:"HH:MM, optional"`
		EndsOn      string `json:"endsOn,omitempty" maxLength:"10" doc:"Repeat until (YYYY-MM-DD), optional"`
	}
}

type idPathInput struct {
	ID uuid.UUID `path:"id"`
}

type sportPathInput struct {
	SportTypeID int64 `path:"sportTypeId"`
}

type saveQuotaInput struct {
	SportTypeID int64 `path:"sportTypeId"`
	Body        struct {
		SessionsPerWeek int `json:"sessionsPerWeek"`
	}
}

func planItemBody(item routine.PlanItem) PlanItemBody {
	return PlanItemBody{
		ID: item.ID, DayOfWeek: item.DayOfWeek, ItemType: item.ItemType, Title: item.Title,
		Description: item.Description, IsCompleted: item.IsCompleted,
		Details: PlanItemDetailsBody(item.Details), // same fields, camelCase JSON
	}
}

func routineBody(week routine.Week) RoutineBody {
	body := RoutineBody{
		Schedules:         make([]ScheduleBody, len(week.Schedules)),
		Quotas:            make([]QuotaBody, len(week.Quotas)),
		PlanItems:         make([]PlanItemBody, len(week.PlanItems)),
		EstimatedWeeklyXP: week.EstimatedWeeklyXP,
	}
	for i, s := range week.Schedules {
		body.Schedules[i] = ScheduleBody{
			ID: s.ID, SportTypeID: s.SportTypeID, SportName: s.SportName, DayOfWeek: s.DayOfWeek, Time: s.Time, EndsOn: s.EndsOn,
		}
	}
	for i, q := range week.Quotas {
		body.Quotas[i] = QuotaBody{
			ID: q.ID, SportTypeID: q.SportTypeID, SportName: q.SportName, SessionsPerWeek: q.SessionsPerWeek, DoneThisWeek: q.DoneThisWeek,
		}
	}
	for i, item := range week.PlanItems {
		body.PlanItems[i] = planItemBody(item)
	}
	return body
}

func sessionsAdded(n int) string {
	if n == 1 {
		return "1 session added to your schedule."
	}
	return fmt.Sprintf("%d sessions added to your schedule.", n)
}

func registerRoutine(api huma.API, deps Deps) {
	svc, logger := deps.Routine, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	tags := []string{"routine"}

	huma.Register(api, huma.Operation{
		OperationID: "listSportTypes", Method: http.MethodGet, Path: "/sport-types",
		Summary: "Selectable sports", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*sportTypesOutput, error) {
		sports, err := svc.SportTypes(ctx)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := make([]SportTypeBody, len(sports))
		for i, s := range sports {
			body[i] = SportTypeBody{ID: s.ID, Name: s.Name, XPMultiplier: xp.Multiplier(s.XPMultiplier)}
		}
		return &sportTypesOutput{Body: body}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "getRoutine", Method: http.MethodGet, Path: "/routine",
		Summary: "My week: fixed sessions, weekly targets, and this week of the active plan",
		Tags:    tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, _ *struct{}) (*routineOutput, error) {
		userID, _ := userFrom(ctx)
		week, err := svc.Week(ctx, userID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &routineOutput{Body: routineBody(week)}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "addSchedules", Method: http.MethodPost, Path: "/routine/schedules",
		Summary: "Add a sport as a fixed session on one or more weekdays", Tags: tags,
		DefaultStatus: http.StatusCreated, Middlewares: signedIn, Errors: []int{400, 401},
	}, func(ctx context.Context, in *addSchedulesInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		b := in.Body
		n, err := svc.AddSchedules(ctx, userID, routine.AddSchedulesInput{SportTypeID: b.SportTypeID, Days: b.Days, Time: b.Time, EndsOn: b.EndsOn})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: sessionsAdded(n)}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deleteSchedule", Method: http.MethodDelete, Path: "/routine/schedules/{id}",
		Summary: "Remove a fixed session", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, in *idPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		if err := svc.DeleteSchedule(ctx, userID, in.ID); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: "Activity removed from your schedule."}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "saveQuota", Method: http.MethodPut, Path: "/routine/quotas/{sportTypeId}",
		Summary: "Set the weekly target for a sport (replaces an existing one)", Tags: tags,
		Middlewares: signedIn, Errors: []int{400, 401},
	}, func(ctx context.Context, in *saveQuotaInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		if err := svc.SaveQuota(ctx, userID, in.SportTypeID, in.Body.SessionsPerWeek); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: "Weekly target saved."}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "deleteQuota", Method: http.MethodDelete, Path: "/routine/quotas/{sportTypeId}",
		Summary: "Remove the weekly target for a sport", Tags: tags, Middlewares: signedIn, Errors: []int{401},
	}, func(ctx context.Context, in *sportPathInput) (*resultOutput, error) {
		userID, _ := userFrom(ctx)
		if err := svc.DeleteQuota(ctx, userID, in.SportTypeID); err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &resultOutput{Body: ResultBody{Status: "success", Message: "Weekly target removed."}}, nil
	})
}
