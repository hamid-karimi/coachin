// Package coaching is the coach hub use cases: the trainee roster with this
// week's adherence, weekly-XP ranking, invite codes, joining a coach by code,
// and assigning the coach's weekly routine to a trainee.
package coaching

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"slices"
	"time"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/coaching"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/dates"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/scorecard"
)

// Roles that may coach / be coached (legacy lib/roles.ts).
var (
	coachRoles   = map[string]bool{"coach": true, "both": true, "admin": true}
	traineeRoles = map[string]bool{"student": true, "both": true, "admin": true}
)

// CanCoach reports whether a role may use the coach hub.
func CanCoach(role string) bool { return coachRoles[role] }

// Sport is a sport type reference.
type Sport struct {
	ID   int64
	Name string
}

// TraineeRow is one active relationship with the trainee's public profile.
type TraineeRow struct {
	ID              uuid.UUID
	Email           *string
	FullName        *string
	AvatarURL       *string
	XP, Level       int64
	LeagueTier      *string
	Sport           *Sport
	NutritionShared bool
}

// ActivePlan is a trainee's active training plan.
type ActivePlan struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	Kind       string
	CreatedAt  time.Time
	WeeksTotal int
}

// PlanWeekItem is a plan item in some week.
type PlanWeekItem struct {
	PlanID uuid.UUID
	Week   int
	Item   scorecard.Item
}

// InviteCode is one of the coach's codes.
type InviteCode struct {
	Code      string
	IsActive  bool
	ExpiresAt *time.Time
	Sport     *Sport
}

// Store is the persistence the use cases need, read as the signed-in user
// (the coach-read RLS policies decide what a coach sees).
type Store interface {
	Role(ctx context.Context, userID uuid.UUID) (string, error)
	Trainees(ctx context.Context, coachID uuid.UUID) ([]TraineeRow, error)
	// LoggedDates maps each trainee to their distinct completed-log dates in [from, to].
	LoggedDates(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID, from, to string) (map[uuid.UUID][]string, error)
	ScheduledDays(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID) (map[uuid.UUID][]int, error)
	ActivePlans(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID) ([]ActivePlan, error)
	PlanItems(ctx context.Context, coachID uuid.UUID, planIDs []uuid.UUID, weeks []int) ([]PlanWeekItem, error)
	WeeklyXP(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]int64, error)
	InviteCodes(ctx context.Context, coachID uuid.UUID) ([]InviteCode, error)
	SportExists(ctx context.Context, sportTypeID int64) (bool, error)
	// UpsertInviteCode replaces the coach's code for a sport.
	UpsertInviteCode(ctx context.Context, coachID uuid.UUID, sportTypeID int64, code string) error
	// JoinByCode returns created | already_connected | reactivated, or the
	// SQL function's error text.
	JoinByCode(ctx context.Context, userID uuid.UUID, code string) (status, failure string, err error)
	// AssignSchedule copies the coach's routine onto the trainee; failure is
	// the SQL function's error text.
	AssignSchedule(ctx context.Context, coachID, traineeID uuid.UUID) (failure string, err error)
}

// Service runs the use cases. now is injectable for tests.
type Service struct {
	store Store
	now   func() time.Time
}

// NewService builds the service; now defaults to time.Now.
func NewService(store Store, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{store: store, now: now}
}

// PlanAdherence is one active plan's current-week adherence.
type PlanAdherence struct {
	PlanID       uuid.UUID
	Kind         string
	AdherencePct float64
}

// Trainee is a roster entry.
type Trainee struct {
	TraineeRow
	WeeklyXP       int64
	Week           []coaching.Day
	DoneCount      int
	ScheduledCount int
	Plans          []PlanAdherence
}

// Hub is the coach hub.
type Hub struct {
	WeekStart   string
	Trainees    []Trainee
	InviteCodes []InviteCode
}

// requireRole returns Forbidden with message unless the user's role is allowed.
func (s *Service) requireRole(ctx context.Context, userID uuid.UUID, allowed map[string]bool, message string) error {
	role, err := s.store.Role(ctx, userID)
	if err != nil {
		return fmt.Errorf("read role: %w", err)
	}
	if !allowed[role] {
		return apperr.New(apperr.Forbidden, message)
	}
	return nil
}

// Hub reads the roster (with this Monday–Sunday week's strip, weekly XP, and
// per-plan adherence) and the coach's invite codes.
func (s *Service) Hub(ctx context.Context, coachID uuid.UUID) (Hub, error) {
	if err := s.requireRole(ctx, coachID, coachRoles, "Only coaches can open the coaching hub."); err != nil {
		return Hub{}, err
	}
	now := s.now()
	monday := dates.MondayOf(now)
	hub := Hub{WeekStart: dates.ToYMD(monday), Trainees: []Trainee{}}
	var err error
	if hub.InviteCodes, err = s.store.InviteCodes(ctx, coachID); err != nil {
		return Hub{}, fmt.Errorf("invite codes: %w", err)
	}
	rows, err := s.store.Trainees(ctx, coachID)
	if err != nil || len(rows) == 0 {
		return hub, err
	}
	ids := traineeIDs(rows)
	logged, err := s.store.LoggedDates(ctx, coachID, ids, hub.WeekStart, dates.ToYMD(monday.AddDate(0, 0, 6)))
	if err != nil {
		return Hub{}, fmt.Errorf("logged dates: %w", err)
	}
	scheduled, err := s.store.ScheduledDays(ctx, coachID, ids)
	if err != nil {
		return Hub{}, fmt.Errorf("scheduled days: %w", err)
	}
	plans, err := s.planAdherence(ctx, coachID, ids, now)
	if err != nil {
		return Hub{}, err
	}
	weekly, err := s.store.WeeklyXP(ctx, coachID, ids)
	if err != nil {
		return Hub{}, fmt.Errorf("weekly xp: %w", err)
	}
	today := dates.ToYMD(now)
	for _, row := range rows {
		t := Trainee{
			TraineeRow: row, WeeklyXP: weekly[row.ID], Plans: plans[row.ID],
			Week:      coaching.WeekStrip(hub.WeekStart, today, scheduled[row.ID], logged[row.ID]),
			DoneCount: len(logged[row.ID]), ScheduledCount: len(scheduled[row.ID]),
		}
		if t.Plans == nil {
			t.Plans = []PlanAdherence{}
		}
		hub.Trainees = append(hub.Trainees, t)
	}
	return hub, nil
}

func traineeIDs(rows []TraineeRow) []uuid.UUID {
	ids := []uuid.UUID{}
	for _, row := range rows {
		if !slices.Contains(ids, row.ID) {
			ids = append(ids, row.ID)
		}
	}
	return ids
}

// planAdherence scores each active plan's current week (the athlete's own
// check-in math, FORMULAS §7); plans with no items that week are left out.
func (s *Service) planAdherence(ctx context.Context, coachID uuid.UUID, ids []uuid.UUID, now time.Time) (map[uuid.UUID][]PlanAdherence, error) {
	plans, err := s.store.ActivePlans(ctx, coachID, ids)
	if err != nil || len(plans) == 0 {
		return map[uuid.UUID][]PlanAdherence{}, err
	}
	weekOf := map[uuid.UUID]int{}
	planIDs, weeks := []uuid.UUID{}, []int{}
	for _, p := range plans {
		weekOf[p.ID] = dates.PlanWeekOf(p.CreatedAt, p.WeeksTotal, now)
		planIDs = append(planIDs, p.ID)
		if !slices.Contains(weeks, weekOf[p.ID]) {
			weeks = append(weeks, weekOf[p.ID])
		}
	}
	items, err := s.store.PlanItems(ctx, coachID, planIDs, weeks)
	if err != nil {
		return nil, fmt.Errorf("plan items: %w", err)
	}
	out := map[uuid.UUID][]PlanAdherence{}
	for _, p := range plans {
		var weekItems []scorecard.Item
		for _, it := range items {
			if it.PlanID == p.ID && it.Week == weekOf[p.ID] {
				weekItems = append(weekItems, it.Item)
			}
		}
		if len(weekItems) == 0 {
			continue
		}
		week := scorecard.ComputeWeek(weekItems, make([]*scorecard.SessionLog, len(weekItems)))
		out[p.UserID] = append(out[p.UserID], PlanAdherence{PlanID: p.ID, Kind: p.Kind, AdherencePct: week.AdherencePct})
	}
	return out, nil
}

// randomChunk draws n characters from the invite alphabet.
func randomChunk(n int) (string, error) {
	out := make([]byte, n)
	limit := big.NewInt(int64(len(coaching.InviteAlphabet)))
	for i := range out {
		k, err := rand.Int(rand.Reader, limit)
		if err != nil {
			return "", err
		}
		out[i] = coaching.InviteAlphabet[k.Int64()]
	}
	return string(out), nil
}

// GenerateInviteCode makes (or replaces) the coach's code for a sport.
func (s *Service) GenerateInviteCode(ctx context.Context, coachID uuid.UUID, sportTypeID int64) (string, error) {
	if sportTypeID <= 0 {
		return "", apperr.New(apperr.Invalid, "Invalid sport type.")
	}
	if err := s.requireRole(ctx, coachID, coachRoles, "Your current role cannot generate coach invite codes."); err != nil {
		return "", err
	}
	if ok, err := s.store.SportExists(ctx, sportTypeID); err != nil || !ok {
		if err != nil {
			return "", fmt.Errorf("sport: %w", err)
		}
		return "", apperr.New(apperr.Invalid, "Invalid sport type.")
	}
	chunk, err := randomChunk(6)
	if err != nil {
		return "", err
	}
	code := coaching.InviteCode(sportTypeID, chunk)
	if err := s.store.UpsertInviteCode(ctx, coachID, sportTypeID, code); err != nil {
		return "", fmt.Errorf("save invite code: %w", err)
	}
	return code, nil
}

// joinMessages is the toast per join outcome.
var joinMessages = map[string]struct{ status, message string }{
	"created":           {"success", "Coach added successfully."},
	"reactivated":       {"success", "Coach connection reactivated successfully."},
	"already_connected": {"info", "You’re already connected to this coach."},
}

// Joined is a join outcome.
type Joined struct {
	Status  string
	Message string
}

// Join connects the user to the coach behind an invite code.
func (s *Service) Join(ctx context.Context, userID uuid.UUID, rawCode string) (Joined, error) {
	code := coaching.NormalizeCode(rawCode)
	if code == "" {
		return Joined{}, apperr.New(apperr.Invalid, "Please enter an invite code.")
	}
	if err := s.requireRole(ctx, userID, traineeRoles, "Your current role cannot add a coach."); err != nil {
		return Joined{}, err
	}
	status, failure, err := s.store.JoinByCode(ctx, userID, code)
	if err != nil {
		return Joined{}, fmt.Errorf("join coach: %w", err)
	}
	if failure != "" {
		return Joined{}, apperr.New(apperr.Invalid, failure)
	}
	out, ok := joinMessages[status]
	if !ok {
		out = joinMessages["created"]
	}
	return Joined{Status: out.status, Message: out.message}, nil
}

// AssignWeeklyPlan replaces the trainee's routine with the coach's.
func (s *Service) AssignWeeklyPlan(ctx context.Context, coachID, traineeID uuid.UUID) (string, error) {
	if err := s.requireRole(ctx, coachID, coachRoles, "Your current role cannot assign plans to trainees."); err != nil {
		return "", err
	}
	failure, err := s.store.AssignSchedule(ctx, coachID, traineeID)
	if err != nil {
		return "", fmt.Errorf("assign schedule: %w", err)
	}
	if failure != "" {
		return "", apperr.New(apperr.Invalid, failure)
	}
	return "Your weekly plan was assigned to the trainee.", nil
}

// Summary is the dashboard coaching card.
type Summary struct {
	TraineeCount    int
	TrainedThisWeek int
}

// Summary counts active trainees and those with a completed log this week.
func (s *Service) Summary(ctx context.Context, coachID uuid.UUID) (Summary, error) {
	if err := s.requireRole(ctx, coachID, coachRoles, "Only coaches have a coaching summary."); err != nil {
		return Summary{}, err
	}
	rows, err := s.store.Trainees(ctx, coachID)
	if err != nil || len(rows) == 0 {
		return Summary{}, err
	}
	ids := traineeIDs(rows)
	monday := dates.MondayOf(s.now())
	logged, err := s.store.LoggedDates(ctx, coachID, ids, dates.ToYMD(monday), dates.ToYMD(monday.AddDate(0, 0, 6)))
	if err != nil {
		return Summary{}, fmt.Errorf("logged dates: %w", err)
	}
	trained := 0
	for _, id := range ids {
		if len(logged[id]) > 0 {
			trained++
		}
	}
	return Summary{TraineeCount: len(ids), TrainedThisWeek: trained}, nil
}
