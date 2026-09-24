package httpapi

import (
	"context"
	"net/http"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

// CheckinService is the weekly check-in.
type CheckinService interface {
	Proposal(ctx context.Context, userID, planID uuid.UUID) (training.Proposal, error)
	Confirm(ctx context.Context, userID uuid.UUID, in training.CheckinInput) (training.Confirmed, error)
}

// ScorecardBody is how the reviewed week went.
type ScorecardBody struct {
	AdherencePct   float64  `json:"adherencePct" doc:"Completed / planned non-meal items, one decimal"`
	PlannedItems   int      `json:"plannedItems"`
	CompletedItems int      `json:"completedItems"`
	PlannedKm      float64  `json:"plannedKm"`
	ActualKm       float64  `json:"actualKm"`
	RedFlags       []string `json:"redFlags"`
	CautionFlags   []string `json:"cautionFlags"`
}

// ProposedItemBody is one session of the proposed next week.
type ProposedItemBody struct {
	DayOfWeek int                 `json:"dayOfWeek" minimum:"0" maximum:"6"`
	ItemType  string              `json:"itemType" enum:"run,strength,stretch,mobility,recovery,meal_note"`
	Title     string              `json:"title" maxLength:"200"`
	Details   PlanItemDetailsBody `json:"details"`
}

// CheckinProposalBody is the check-in page.
type CheckinProposalBody struct {
	PlanID     uuid.UUID          `json:"planId"`
	ReviewWeek int                `json:"reviewWeek" doc:"The last fully elapsed week"`
	TargetWeek int                `json:"targetWeek" doc:"The only week the check-in rewrites"`
	Scorecard  ScorecardBody      `json:"scorecard"`
	Decision   string             `json:"decision" enum:"advance,repeat,deload"`
	Reasons    []string           `json:"reasons"`
	Summary    string             `json:"summary" doc:"The AI's summary, or \"Keeping week N as planned…\" without it"`
	Items      []ProposedItemBody `json:"items"`
}

type checkinProposalOutput struct {
	Body CheckinProposalBody
}

type confirmCheckinInput struct {
	ID   uuid.UUID `path:"id"`
	Body struct {
		CheckinWeek int                `json:"checkinWeek" doc:"The reviewed week, as proposed"`
		Summary     string             `json:"summary,omitempty" maxLength:"2000"`
		Items       []ProposedItemBody `json:"items" maxItems:"60"`
	}
}

// CheckinConfirmedBody is the outcome of a confirmed check-in.
type CheckinConfirmedBody struct {
	ResultBody
	AwardedXP int `json:"awardedXp"`
}

type checkinConfirmedOutput struct {
	Body CheckinConfirmedBody
}

func registerCheckins(api huma.API, deps Deps) {
	svc, logger := deps.Checkins, deps.logger()
	signedIn := huma.Middlewares{requireUser(api)}
	// Every proposal asks the AI to rewrite a week.
	proposing := huma.Middlewares{requireUser(api), rateLimited(api, newLimiter(10*time.Second, 5))}
	tags := []string{"training"}

	huma.Register(api, huma.Operation{
		OperationID: "getCheckinProposal", Method: http.MethodGet, Path: "/training/plans/{id}/checkin",
		Summary:     "Score the last elapsed week and propose the next one",
		Description: "404 unless a check-in is due. The AI rewrites next week within the rule-based decision; without it the week is kept.",
		Tags:        tags, Middlewares: proposing, Errors: []int{401, 404, 429},
	}, func(ctx context.Context, in *idPathInput) (*checkinProposalOutput, error) {
		userID, _ := userFrom(ctx)
		p, err := svc.Proposal(ctx, userID, in.ID)
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		items := make([]ProposedItemBody, len(p.Items))
		for i, item := range p.Items {
			items[i] = ProposedItemBody{
				DayOfWeek: item.DayOfWeek, ItemType: item.ItemType, Title: item.Title,
				Details: PlanItemDetailsBody(item.Details),
			}
		}
		c := p.Scorecard
		return &checkinProposalOutput{Body: CheckinProposalBody{
			PlanID: p.PlanID, ReviewWeek: p.ReviewWeek, TargetWeek: p.TargetWeek,
			Scorecard: ScorecardBody{
				AdherencePct: c.AdherencePct, PlannedItems: c.PlannedItems, CompletedItems: c.CompletedItems,
				PlannedKm: c.PlannedKm, ActualKm: c.ActualKm, RedFlags: c.RedFlags, CautionFlags: c.CautionFlags,
			},
			Decision: string(p.Decision), Reasons: p.Reasons, Summary: p.Summary, Items: items,
		}}, nil
	})

	huma.Register(api, huma.Operation{
		OperationID: "confirmCheckin", Method: http.MethodPost, Path: "/training/plans/{id}/checkin",
		Summary:     "Confirm the check-in: rewrite only the next week (+20 XP once)",
		Description: "The scorecard and decision are recomputed server-side; items are revalidated and forced onto the target week.",
		Tags:        tags, Middlewares: signedIn, Errors: []int{400, 401, 404, 409},
	}, func(ctx context.Context, in *confirmCheckinInput) (*checkinConfirmedOutput, error) {
		userID, _ := userFrom(ctx)
		items := make([]aigen.PlanItemInput, len(in.Body.Items))
		for i, item := range in.Body.Items {
			items[i] = aigen.PlanItemInput{
				DayOfWeek: item.DayOfWeek, ItemType: item.ItemType, Title: item.Title,
				Details: aigen.ItemDetails(item.Details),
			}
		}
		done, err := svc.Confirm(ctx, userID, training.CheckinInput{
			PlanID: in.ID, CheckinWeek: in.Body.CheckinWeek, Summary: in.Body.Summary, Items: items,
		})
		if err != nil {
			return nil, toProblem(ctx, logger, err)
		}
		return &checkinConfirmedOutput{Body: CheckinConfirmedBody{
			ResultBody: ResultBody{Status: "success", Message: done.Message}, AwardedXP: done.AwardedXP,
		}}, nil
	})
}
