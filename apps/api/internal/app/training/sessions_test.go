package training

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
)

type fakeSessionStore struct {
	item     SessionItem
	itemErr  error
	logErr   error
	awarded  int
	logged   []NewSessionLog
	feedback []aigen.Feedback
}

func (f *fakeSessionStore) SessionItem(context.Context, uuid.UUID, uuid.UUID) (SessionItem, error) {
	return f.item, f.itemErr
}

func (f *fakeSessionStore) CreateSessionLog(_ context.Context, _ uuid.UUID, log NewSessionLog) (uuid.UUID, int, error) {
	if f.logErr != nil {
		return uuid.Nil, 0, f.logErr
	}
	f.logged = append(f.logged, log)
	return uuid.New(), f.awarded, nil
}

func (f *fakeSessionStore) SaveFeedback(_ context.Context, _, _ uuid.UUID, feedback aigen.Feedback) error {
	f.feedback = append(f.feedback, feedback)
	return nil
}

// replyAI answers every request with the same text; empty means unavailable.
type replyAI struct {
	text     string
	requests []aigen.Request
}

func (r *replyAI) GenerateJSON(_ context.Context, req aigen.Request) (aigen.Result, bool) {
	r.requests = append(r.requests, req)
	return aigen.Result{Text: r.text, Model: "fake"}, r.text != ""
}

func TestLogSessionValidation(t *testing.T) {
	cases := map[string]struct {
		in    SessionInput
		store fakeSessionStore
		kind  apperr.Kind
		msg   string
	}{
		"sport":     {SessionInput{Sport: "stretch"}, fakeSessionStore{}, apperr.Invalid, "Only run and strength sessions can be logged"},
		"rpe low":   {SessionInput{Sport: "run", RPE: ptrTo(0)}, fakeSessionStore{}, apperr.Invalid, "RPE must be between 1 and 10"},
		"rpe high":  {SessionInput{Sport: "run", RPE: ptrTo(11)}, fakeSessionStore{}, apperr.Invalid, "RPE must be between 1 and 10"},
		"not found": {SessionInput{Sport: "run"}, fakeSessionStore{itemErr: ErrNotFound}, apperr.NotFound, "Plan item not found"},
		"mismatch":  {SessionInput{Sport: "run"}, fakeSessionStore{item: SessionItem{ItemType: "strength"}}, apperr.Invalid, "Session type does not match the plan item"},
		"repeat":    {SessionInput{Sport: "run"}, fakeSessionStore{item: SessionItem{ItemType: "run"}, logErr: ErrAlreadyLogged}, apperr.Conflict, "Session already logged"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			store := tc.store
			_, err := NewSessions(&store, &replyAI{}).LogSession(context.Background(), uuid.New(), tc.in)
			var appErr *apperr.Error
			if kindOf(err) != tc.kind || !asAppErr(err, &appErr) || appErr.Message != tc.msg {
				t.Fatalf("err = %v, want %v %q", err, tc.kind, tc.msg)
			}
		})
	}
}

func TestLogRunWithFeedback(t *testing.T) {
	store := &fakeSessionStore{item: SessionItem{ItemType: "run", Title: "Easy 5k", Details: json.RawMessage(`{"distance_km":5}`)}, awarded: 10}
	ai := &replyAI{text: `{"message":"Nicely paced.","flag":"ok"}`}
	logged, err := NewSessions(store, ai).LogSession(context.Background(), uuid.New(), SessionInput{
		Sport: "run", RPE: ptrTo(6), Note: "  felt good ", DistanceKm: ptrTo(5.2), DurationMin: ptrTo(-3.0), AvgHR: ptrTo(150.6),
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := string(store.logged[0].Actual); got != `{"distance_km":5.2,"avg_hr":151}` {
		t.Errorf("actual = %s", got)
	}
	if *store.logged[0].Note != "felt good" {
		t.Errorf("note = %q", *store.logged[0].Note)
	}
	if logged.Message != "Session logged · +10 XP 🏃 Nicely paced." || logged.AwardedXP != 10 {
		t.Errorf("logged = %+v", logged)
	}
	if len(store.feedback) != 1 || store.feedback[0].Flag != aigen.FlagOK {
		t.Errorf("feedback = %+v", store.feedback)
	}
	if !strings.Contains(ai.requests[0].Prompt, "Easy 5k") {
		t.Errorf("prompt lacks the item: %s", ai.requests[0].Prompt)
	}
}

func TestLogStrengthWithoutAI(t *testing.T) {
	exercises := []any{map[string]any{"name": "Squat", "sets": []any{
		map[string]any{"reps": 5.0, "weight_kg": 100.0}, map[string]any{"reps": 5.0, "weight_kg": 100.0},
	}}}

	// AI down, nothing flagged → no feedback; the volume still celebrates.
	store := &fakeSessionStore{item: SessionItem{ItemType: "strength"}, awarded: 10}
	logged, err := NewSessions(store, &replyAI{}).LogSession(context.Background(), uuid.New(), SessionInput{Sport: "strength", Exercises: exercises})
	if err != nil {
		t.Fatal(err)
	}
	want := "Session logged · +10 XP You lifted 1,000 kg total — that's a grand piano 🎹."
	if logged.Message != want || logged.Feedback != nil || logged.TotalVolumeKg != 1000 {
		t.Errorf("logged = %+v", logged)
	}
	if got := string(store.logged[0].Actual); got != `{"exercises":[{"name":"Squat","sets":[{"weight_kg":100,"reps":5},{"weight_kg":100,"reps":5}]}]}` {
		t.Errorf("actual = %s", got)
	}

	// AI down but the note is flagged → the flag persists for the scorecard.
	store = &fakeSessionStore{item: SessionItem{ItemType: "strength"}}
	logged, err = NewSessions(store, &replyAI{}).LogSession(context.Background(), uuid.New(), SessionInput{
		Sport: "strength", RPE: ptrTo(9), Note: "sharp pain in my knee",
	})
	if err != nil {
		t.Fatal(err)
	}
	if logged.Feedback == nil || logged.Feedback.Flag != aigen.FlagRed || len(store.feedback) != 1 {
		t.Fatalf("feedback = %+v", logged.Feedback)
	}
	if logged.Message != "Session logged. 🏃 "+flaggedMessage {
		t.Errorf("message = %q", logged.Message)
	}
	if got := string(store.logged[0].Actual); got != `{}` {
		t.Errorf("actual = %s", got)
	}
}
