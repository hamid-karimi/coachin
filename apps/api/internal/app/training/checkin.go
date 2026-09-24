package training

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/planitem"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
)

// CheckinPlan is the active plan a check-in reviews.
type CheckinPlan struct {
	ID         uuid.UUID
	WeeksTotal int
	Summary    *string
	CreatedAt  time.Time
	Intake     json.RawMessage
}

// WeekItem is a plan item as the scorecard and the adjustment read it.
type WeekItem struct {
	ID          uuid.UUID
	Week        int
	DayOfWeek   int
	ItemType    string
	Title       string
	Details     json.RawMessage
	IsCompleted bool
}

// LoggedSession is a session log keyed by its plan item.
type LoggedSession struct {
	PlanItemID uuid.UUID
	Log        scorecard.SessionLog
}

// WeekAdjustment is a confirmed check-in for apply_week_adjustment.
type WeekAdjustment struct {
	PlanID      uuid.UUID
	CheckinWeek int
	TargetWeek  int
	Scorecard   scorecard.Week
	Decision    scorecard.Decision
	Summary     *string
	Items       []aigen.PlanItemInput
}

// ErrAlreadyCheckedIn means the reviewed week already has a check-in.
var ErrAlreadyCheckedIn = errors.New("week already checked in")

// CheckinStore is the persistence the weekly check-in needs.
type CheckinStore interface {
	// ActivePlan returns ErrNotFound unless the plan is the user's and active.
	ActivePlan(ctx context.Context, userID, planID uuid.UUID) (CheckinPlan, error)
	// CheckinScorecard is a week's recorded scorecard; ok is false without a check-in.
	CheckinScorecard(ctx context.Context, userID, planID uuid.UUID, week int) (card json.RawMessage, ok bool, err error)
	// WeekItems lists the plan's items in weeks from..to, by week and weekday.
	WeekItems(ctx context.Context, userID, planID uuid.UUID, from, to int) ([]WeekItem, error)
	SessionLogs(ctx context.Context, userID uuid.UUID, itemIDs []uuid.UUID) ([]LoggedSession, error)
	// ApplyWeekAdjustment returns the XP awarded; ErrAlreadyCheckedIn on a repeat.
	ApplyWeekAdjustment(ctx context.Context, userID uuid.UUID, adj WeekAdjustment) (int, error)
}

// Checkins runs the weekly check-in. now is injectable for tests.
type Checkins struct {
	store CheckinStore
	ai    JSONGenerator
	now   func() time.Time
}

// NewCheckins builds the service; now defaults to time.Now.
func NewCheckins(store CheckinStore, ai JSONGenerator, now func() time.Time) *Checkins {
	if now == nil {
		now = time.Now
	}
	return &Checkins{store: store, ai: ai, now: now}
}

// Proposal is the check-in page: how the week went and the proposed next week.
type Proposal struct {
	PlanID     uuid.UUID
	ReviewWeek int
	TargetWeek int
	Scorecard  scorecard.Week
	Decision   scorecard.Decision
	Reasons    []string
	Summary    string
	Items      []aigen.PlanItemInput
}

// CheckinInput is a confirmed proposal as posted back.
type CheckinInput struct {
	PlanID      uuid.UUID
	CheckinWeek int
	Summary     string
	Items       []aigen.PlanItemInput // revalidated like generated plans
}

// errNoCheckinDue covers every plan without a pending check-in: not the
// user's, not active, week 1 still running, the last week, already reviewed,
// or an empty next week.
var errNoCheckinDue = apperr.New(apperr.NotFound, "No check-in is due for this plan")

// review is the reviewed week scored and decided, plus next week's items.
type review struct {
	plan       CheckinPlan
	week       int
	scorecard  scorecard.Week
	result     scorecard.Result
	nextInputs []aigen.PlanItemInput
}

// Proposal scores the last elapsed week, decides what to do with the next
// one, and asks the AI to rewrite it within that decision; without the AI the
// next week is kept as planned.
func (c *Checkins) Proposal(ctx context.Context, userID, planID uuid.UUID) (Proposal, error) {
	r, err := c.review(ctx, userID, planID)
	if err != nil {
		return Proposal{}, err
	}
	target := r.week + 1
	items, summary := r.nextInputs, fmt.Sprintf("Keeping week %d as planned. %s", target, strings.Join(r.result.Reasons, " "))

	card, _ := json.Marshal(r.scorecard)
	result, ok := c.ai.GenerateJSON(ctx, aigen.WeekAdjustmentRequest(aigen.AdjustmentInput{
		Scorecard: card, Decision: string(r.result.Decision), Reasons: r.result.Reasons,
		NextWeekItems: r.nextInputs, TargetWeek: target, IntakeSummary: intakeSummary(r.plan),
	}))
	if ok {
		if adjusted, adjustedSummary, err := aigen.ParseAdjustment(result.Text, target); err == nil {
			items, summary = adjusted, adjustedSummary
		}
	}
	return Proposal{
		PlanID: planID, ReviewWeek: r.week, TargetWeek: target, Scorecard: r.scorecard,
		Decision: r.result.Decision, Reasons: r.result.Reasons, Summary: summary, Items: items,
	}, nil
}

// Confirm applies a proposal: the scorecard and decision are recomputed here,
// the posted items revalidated and forced onto the target week, and only that
// week is rewritten (+20 XP once).
func (c *Checkins) Confirm(ctx context.Context, userID uuid.UUID, in CheckinInput) (Confirmed, error) {
	r, err := c.review(ctx, userID, in.PlanID)
	if err != nil {
		return Confirmed{}, err
	}
	if in.CheckinWeek != r.week {
		return Confirmed{}, apperr.New(apperr.Conflict, "This check-in is out of date — reload it")
	}
	target := r.week + 1
	items := revalidate(in.Items, target)
	if len(items) == 0 {
		return Confirmed{}, apperr.New(apperr.Invalid, "The adjusted week has no valid items")
	}
	awarded, err := c.store.ApplyWeekAdjustment(ctx, userID, WeekAdjustment{
		PlanID: in.PlanID, CheckinWeek: r.week, TargetWeek: target, Scorecard: r.scorecard,
		Decision: r.result.Decision, Summary: optionalText(jsnum.Slice(strings.TrimSpace(in.Summary), 500)), Items: items,
	})
	if errors.Is(err, ErrAlreadyCheckedIn) {
		return Confirmed{}, apperr.New(apperr.Conflict, "This week was already checked in")
	}
	if err != nil {
		return Confirmed{}, fmt.Errorf("apply check-in: %w", err)
	}
	message := fmt.Sprintf("Week %d updated.", target)
	if awarded > 0 {
		message = fmt.Sprintf("Week %d updated · +%d XP", target, awarded)
	}
	return Confirmed{Message: message, AwardedXP: awarded}, nil
}

// Confirmed is the outcome of a confirmed check-in.
type Confirmed struct {
	Message   string
	AwardedXP int
}

func (c *Checkins) review(ctx context.Context, userID, planID uuid.UUID) (review, error) {
	plan, err := c.store.ActivePlan(ctx, userID, planID)
	if errors.Is(err, ErrNotFound) {
		return review{}, errNoCheckinDue
	}
	if err != nil {
		return review{}, fmt.Errorf("load plan: %w", err)
	}
	week := dates.LastElapsedPlanWeek(plan.CreatedAt, plan.WeeksTotal, c.now())
	if week < 1 || week >= plan.WeeksTotal {
		return review{}, errNoCheckinDue
	}
	if _, done, err := c.store.CheckinScorecard(ctx, userID, planID, week); err != nil {
		return review{}, fmt.Errorf("load check-in: %w", err)
	} else if done {
		return review{}, errNoCheckinDue
	}

	// Weeks week-2 … week+1: the stall window, the reviewed week, and next week.
	items, err := c.store.WeekItems(ctx, userID, planID, max(week-2, 1), week+1)
	if err != nil {
		return review{}, fmt.Errorf("load plan items: %w", err)
	}
	byWeek := map[int][]WeekItem{}
	for _, item := range items {
		byWeek[item.Week] = append(byWeek[item.Week], item)
	}
	if len(byWeek[week+1]) == 0 {
		return review{}, errNoCheckinDue
	}

	ids := make([]uuid.UUID, 0, len(items))
	for _, item := range items {
		if item.Week <= week {
			ids = append(ids, item.ID)
		}
	}
	logs, err := c.store.SessionLogs(ctx, userID, ids)
	if err != nil {
		return review{}, fmt.Errorf("load session logs: %w", err)
	}
	logOf := make(map[uuid.UUID]*scorecard.SessionLog, len(logs))
	for i := range logs {
		logOf[logs[i].PlanItemID] = &logs[i].Log
	}

	reviewed := byWeek[week]
	scoreItems := make([]scorecard.Item, len(reviewed))
	scoreLogs := make([]*scorecard.SessionLog, len(reviewed))
	for i, item := range reviewed {
		scoreItems[i] = scorecard.Item{ItemType: item.ItemType, IsCompleted: item.IsCompleted, Details: detailsMap(item.Details)}
		scoreLogs[i] = logOf[item.ID]
	}
	card := scorecard.ComputeWeek(scoreItems, scoreLogs)

	var previous *scorecard.Week
	if week > 1 {
		raw, ok, err := c.store.CheckinScorecard(ctx, userID, planID, week-1)
		if err != nil {
			return review{}, fmt.Errorf("load previous check-in: %w", err)
		}
		var prev scorecard.Week
		if ok && json.Unmarshal(raw, &prev) == nil {
			previous = &prev
		}
	}

	if week >= 3 {
		strength := make([][]*scorecard.SessionLog, 3)
		for w := week - 2; w <= week; w++ {
			for _, item := range byWeek[w] {
				if log := logOf[item.ID]; item.ItemType == "strength" && log != nil {
					strength[w-(week-2)] = append(strength[w-(week-2)], log)
				}
			}
		}
		for _, name := range scorecard.StalledLifts(strength) {
			card.CautionFlags = append(card.CautionFlags, name+": same load 3 weeks running — consider a deload or variation")
		}
	}

	next := byWeek[week+1]
	inputs := make([]aigen.PlanItemInput, len(next))
	for i, item := range next {
		inputs[i] = aigen.PlanItemInput{
			Week: item.Week, DayOfWeek: item.DayOfWeek, ItemType: item.ItemType, Title: item.Title,
			Details: aigen.ItemDetails(planitem.ParseDetails(item.Details)),
		}
	}
	return review{plan: plan, week: week, scorecard: card, result: scorecard.Decide(card, previous), nextInputs: inputs}, nil
}

// revalidate runs the plan-generation checks on posted items, all forced
// onto the target week.
func revalidate(items []aigen.PlanItemInput, target int) []aigen.PlanItemInput {
	forced := make([]aigen.PlanItemInput, len(items))
	for i, item := range items {
		item.Week = target
		forced[i] = item
	}
	raw, err := json.Marshal(forced)
	if err != nil {
		return nil
	}
	var decoded any
	_ = json.Unmarshal(raw, &decoded)
	return aigen.ValidateItems(decoded)
}

// detailsMap decodes an item's details object; anything else reads as empty.
func detailsMap(raw json.RawMessage) map[string]any {
	var details map[string]any
	_ = json.Unmarshal(raw, &details)
	return details
}

// intakeSummary is the plan context line the adjustment prompt carries:
// "42km race plan · intermediate runner · 4 days/week · <summary>".
func intakeSummary(plan CheckinPlan) string {
	var intake map[string]any
	_ = json.Unmarshal(plan.Intake, &intake)
	parts := []string{}
	for _, field := range []struct{ key, suffix string }{
		{"race_distance_km", "km race plan"}, {"experience_level", " runner"}, {"days_per_week", " days/week"},
	} {
		if v := intake[field.key]; truthy(v) {
			parts = append(parts, jsnum.ToString(v)+field.suffix)
		}
	}
	if plan.Summary != nil && *plan.Summary != "" {
		parts = append(parts, *plan.Summary)
	}
	return strings.Join(parts, " · ")
}

// truthy is JavaScript truthiness for decoded JSON values.
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case float64:
		return x == x && x != 0 // NaN is falsy
	}
	return true
}
