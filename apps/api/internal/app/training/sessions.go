package training

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/jsnum"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/workout"
)

// SessionItem is the plan item a session log belongs to.
type SessionItem struct {
	ItemType string
	Title    string
	Details  json.RawMessage
}

// NewSessionLog is a "how did it go" entry to store.
type NewSessionLog struct {
	PlanItemID uuid.UUID
	Sport      string
	RPE        *int
	Actual     json.RawMessage
	Note       *string
}

// ErrAlreadyLogged means the plan item already has a session log.
var ErrAlreadyLogged = errors.New("session already logged")

// SessionStore is the persistence session logging needs.
type SessionStore interface {
	// SessionItem returns ErrNotFound unless the item is in the user's plans.
	SessionItem(ctx context.Context, userID, itemID uuid.UUID) (SessionItem, error)
	// CreateSessionLog stores the log, marks the item done, and awards the
	// +10 XP once; ErrAlreadyLogged for a second log of the item.
	CreateSessionLog(ctx context.Context, userID uuid.UUID, log NewSessionLog) (logID uuid.UUID, awardedXP int, err error)
	SaveFeedback(ctx context.Context, userID, logID uuid.UUID, feedback aigen.Feedback) error
}

// Sessions runs session logging.
type Sessions struct {
	store SessionStore
	ai    JSONGenerator
}

// NewSessions builds the service.
func NewSessions(store SessionStore, ai JSONGenerator) *Sessions {
	return &Sessions{store: store, ai: ai}
}

// SessionInput is the log sheet as submitted; everything but the item and
// sport is optional.
type SessionInput struct {
	PlanItemID  uuid.UUID
	Sport       string // run | strength
	RPE         *int
	Note        string
	DistanceKm  *float64
	DurationMin *float64
	AvgHR       *float64
	Exercises   any // decoded JSON, normalized here
}

// SessionLogged is the outcome shown to the athlete.
type SessionLogged struct {
	Message       string
	AwardedXP     int
	Feedback      *aigen.Feedback
	TotalVolumeKg float64
}

// runActual and strengthActual keep the legacy key order of session_logs.actual.
type runActual struct {
	DistanceKm  *float64 `json:"distance_km,omitempty"`
	DurationMin *float64 `json:"duration_min,omitempty"`
	AvgHR       *float64 `json:"avg_hr,omitempty"`
}

type strengthActual struct {
	Exercises []workout.Exercise `json:"exercises,omitempty"`
}

// flaggedMessage stands in for the AI's comment when it is unavailable but the
// note was flagged: the weekly scorecard reads the flag, so it must persist.
const flaggedMessage = "Your note was flagged — take it easy and monitor how it feels."

// LogSession stores how a completed run/strength session went (+10 XP once)
// and adds AI feedback. The feedback never fails the log.
func (s *Sessions) LogSession(ctx context.Context, userID uuid.UUID, in SessionInput) (SessionLogged, error) {
	if in.Sport != "run" && in.Sport != "strength" {
		return SessionLogged{}, apperr.New(apperr.Invalid, "Only run and strength sessions can be logged")
	}
	if in.RPE != nil && (*in.RPE < 1 || *in.RPE > 10) {
		return SessionLogged{}, apperr.New(apperr.Invalid, "RPE must be between 1 and 10")
	}
	note := optionalText(jsnum.Slice(strings.TrimSpace(in.Note), 500))

	var actual any
	var exercises []workout.Exercise
	if in.Sport == "run" {
		run := runActual{DistanceKm: optionalNumber(in.DistanceKm), DurationMin: optionalNumber(in.DurationMin)}
		if hr := optionalNumber(in.AvgHR); hr != nil {
			rounded := jsnum.Round(*hr)
			run.AvgHR = &rounded
		}
		actual = run
	} else {
		exercises = workout.NormalizeLoggedExercises(in.Exercises)
		actual = strengthActual{Exercises: exercises}
	}
	actualJSON, _ := json.Marshal(actual)

	item, err := s.store.SessionItem(ctx, userID, in.PlanItemID)
	if errors.Is(err, ErrNotFound) {
		return SessionLogged{}, apperr.New(apperr.NotFound, "Plan item not found")
	}
	if err != nil {
		return SessionLogged{}, fmt.Errorf("load plan item: %w", err)
	}
	if item.ItemType != in.Sport {
		return SessionLogged{}, apperr.New(apperr.Invalid, "Session type does not match the plan item")
	}

	logID, awarded, err := s.store.CreateSessionLog(ctx, userID, NewSessionLog{
		PlanItemID: in.PlanItemID, Sport: in.Sport, RPE: in.RPE, Actual: actualJSON, Note: note,
	})
	if errors.Is(err, ErrAlreadyLogged) {
		return SessionLogged{}, apperr.New(apperr.Conflict, "Session already logged")
	}
	if err != nil {
		return SessionLogged{}, fmt.Errorf("save session log: %w", err)
	}

	feedback := s.feedback(ctx, item, actualJSON, in.RPE, note)
	if feedback != nil {
		// Best-effort, as the log and XP already succeeded.
		_ = s.store.SaveFeedback(ctx, userID, logID, *feedback)
	}

	volume := workout.TotalVolumeKg(exercises)
	return SessionLogged{
		Message: sessionMessage(awarded, volume, feedback), AwardedXP: awarded, Feedback: feedback, TotalVolumeKg: volume,
	}, nil
}

func (s *Sessions) feedback(ctx context.Context, item SessionItem, actual json.RawMessage, rpe *int, note *string) *aigen.Feedback {
	precheck := aigen.RedFlagPrecheck(note, rpe)
	fallback := func() *aigen.Feedback {
		if precheck == aigen.FlagOK {
			return nil
		}
		return &aigen.Feedback{Message: flaggedMessage, Flag: precheck}
	}
	result, ok := s.ai.GenerateJSON(ctx, aigen.SessionFeedbackRequest(aigen.FeedbackInput{
		ItemTitle: item.Title, ItemType: item.ItemType, Planned: plannedDetails(item.Details), Actual: actual, RPE: rpe, Note: note,
	}))
	if !ok {
		return fallback()
	}
	feedback, err := aigen.ParseFeedback(result.Text, precheck)
	if err != nil {
		return fallback()
	}
	return &feedback
}

// plannedDetails is the item's details when they are an object, else null.
func plannedDetails(details json.RawMessage) json.RawMessage {
	trimmed := strings.TrimSpace(string(details))
	if strings.HasPrefix(trimmed, "{") {
		return details
	}
	return nil
}

// sessionMessage is the legacy toast: XP, the volume celebration, feedback.
func sessionMessage(awarded int, volume float64, feedback *aigen.Feedback) string {
	message := "Session logged."
	if awarded > 0 {
		message = fmt.Sprintf("Session logged · +%d XP", awarded)
	}
	if volume > 0 && !math.IsNaN(volume) {
		message += " You lifted " + jsnum.FormatEnUS(volume) + " kg total"
		if eq, ok := workout.VolumeEquivalence(volume); ok {
			message += " — that's " + eq.Label + " " + eq.Emoji
		}
		message += "."
	}
	if feedback != nil {
		message += " 🏃 " + feedback.Message
	}
	return message
}
