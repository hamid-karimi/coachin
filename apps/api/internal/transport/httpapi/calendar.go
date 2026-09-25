package httpapi

import (
	"context"
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/calendar"
)

// CalendarService builds calendar weeks.
type CalendarService interface {
	Week(ctx context.Context, userID uuid.UUID, anchor string) (calendar.Week, error)
}

// CalendarRoutineBody is a fixed session on a calendar day.
type CalendarRoutineBody struct {
	SportTypeID *int64  `json:"sportTypeId"`
	SportName   *string `json:"sportName"`
	Time        *string `json:"time" doc:"HH:MM"`
	Done        bool    `json:"done" doc:"A completed log of the sport that day"`
}

// CalendarDayBody is one day cell.
type CalendarDayBody struct {
	Date          string                `json:"date" format:"date"`
	DayOfWeek     int                   `json:"dayOfWeek" minimum:"0" maximum:"6"`
	IsToday       bool                  `json:"isToday"`
	Logged        bool                  `json:"logged" doc:"Any completed log that day"`
	Routines      []CalendarRoutineBody `json:"routines"`
	PlanItems     []PlanItemBody        `json:"planItems" doc:"Blended across every active plan, each in its own week"`
	HardCollision bool                  `json:"hardCollision" doc:"2+ run/strength items that day"`
	Meals         *DayMealsBody         `json:"meals,omitempty" doc:"The active meal plan's menu that weekday; absent without one"`
}

// MealAdherenceBody compares a day's logged meals with the plan (meal types and kcal only).
type MealAdherenceBody struct {
	SlotsPlanned int      `json:"slotsPlanned"`
	SlotsLogged  int      `json:"slotsLogged"`
	KcalPlanned  float64  `json:"kcalPlanned"`
	KcalLogged   float64  `json:"kcalLogged"`
	KcalRatio    *float64 `json:"kcalRatio"`
}

// DayMealsBody is a day's planned menu summary.
type DayMealsBody struct {
	PlannedCount int                `json:"plannedCount"`
	PlannedKcal  float64            `json:"plannedKcal"`
	Adherence    *MealAdherenceBody `json:"adherence,omitempty" doc:"Today and past days only"`
}

// CalendarBody is one Monday–Sunday week.
type CalendarBody struct {
	WeekStart     string            `json:"weekStart" format:"date"`
	WeekEnd       string            `json:"weekEnd" format:"date"`
	PrevWeek      string            `json:"prevWeek" format:"date"`
	NextWeek      string            `json:"nextWeek" format:"date"`
	Today         string            `json:"today" format:"date"`
	IsCurrentWeek bool              `json:"isCurrentWeek"`
	Quotas        []QuotaBody       `json:"quotas" doc:"Weekly targets scored on the viewed week"`
	Days          []CalendarDayBody `json:"days"`
}

type calendarInput struct {
	Week string `query:"week" doc:"Any date of the week (YYYY-MM-DD); this week when missing or invalid"`
}

type calendarWeekOutput struct {
	Body CalendarBody
}

func registerCalendar(api huma.API, deps Deps) {
	svc, logger := deps.Calendar, deps.logger()

	huma.Register(api, huma.Operation{
		OperationID: "getCalendar", Method: http.MethodGet, Path: "/calendar",
		Summary: "A week of routine, plan items, and logged workouts on real dates",
		Tags:    []string{"calendar"}, Middlewares: huma.Middlewares{requireUser(api)}, Errors: []int{401},
	}, func(ctx context.Context, in *calendarInput) (*calendarWeekOutput, error) {
		userID, _ := userFrom(ctx)
		week, err := svc.Week(ctx, userID, in.Week)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		body := CalendarBody{
			WeekStart: week.Monday, WeekEnd: week.Sunday, PrevWeek: week.PrevWeek, NextWeek: week.NextWeek,
			Today: week.Today, IsCurrentWeek: week.IsCurrentWeek,
			Quotas: make([]QuotaBody, len(week.Quotas)), Days: make([]CalendarDayBody, len(week.Days)),
		}
		for i, q := range week.Quotas {
			body.Quotas[i] = quotaBody(q)
		}
		for i, d := range week.Days {
			day := CalendarDayBody{
				Date: d.Date, DayOfWeek: d.Weekday, IsToday: d.IsToday, Logged: d.Logged, HardCollision: d.HardCollision,
				Routines: make([]CalendarRoutineBody, len(d.Routines)), PlanItems: make([]PlanItemBody, len(d.PlanItems)),
			}
			for j, r := range d.Routines {
				day.Routines[j] = CalendarRoutineBody{SportTypeID: r.SportTypeID, SportName: r.SportName, Time: r.Time, Done: r.Done}
			}
			for j, item := range d.PlanItems {
				day.PlanItems[j] = planItemBody(item)
			}
			if m := d.Meals; m != nil {
				day.Meals = &DayMealsBody{PlannedCount: m.PlannedCount, PlannedKcal: m.PlannedKcal}
				if a := m.Adherence; a != nil {
					day.Meals.Adherence = &MealAdherenceBody{
						SlotsPlanned: a.SlotsPlanned, SlotsLogged: a.SlotsLogged, KcalPlanned: a.KcalPlanned, KcalLogged: a.KcalLogged, KcalRatio: a.KcalRatio,
					}
				}
			}
			body.Days[i] = day
		}
		return &calendarWeekOutput{Body: body}, nil
	})
}
