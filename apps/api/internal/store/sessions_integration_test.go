package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

// cannedAI answers every request with text; empty means unavailable.
type cannedAI struct{ text string }

func (c cannedAI) GenerateJSON(context.Context, aigen.Request) (aigen.Result, bool) {
	return aigen.Result{Text: c.text, Model: "fake"}, c.text != ""
}

func appKind(err error) apperr.Kind {
	var appErr *apperr.Error
	if errors.As(err, &appErr) {
		return appErr.Kind
	}
	return 0
}

func TestSessionLogAndCheckinOnPostgres(t *testing.T) {
	urls := migratedDB(t)
	ctx := context.Background()
	owner, err := pgx.Connect(ctx, urls.Owner)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = owner.Close(ctx) }()
	pool, err := store.Open(ctx, urls.App)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()

	ada, bob := seedUser(t, owner, "ada@example.com"), seedUser(t, owner, "bob@example.com")
	now := func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) } // plan week 4
	var plan, run, next uuid.UUID
	if err := owner.QueryRow(ctx, `INSERT INTO training_plans (user_id, weeks_total, created_at, summary, intake)
		VALUES ($1, 12, '2026-09-01T08:00:00Z', 'Base', '{"days_per_week":3}') RETURNING id`, ada).Scan(&plan); err != nil {
		t.Fatal(err)
	}
	if err := owner.QueryRow(ctx, `INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title, details)
		VALUES ($1, 3, 2, 'run', 'Easy 5k', '{"distance_km": 5}') RETURNING id`, plan).Scan(&run); err != nil {
		t.Fatal(err)
	}
	if err := owner.QueryRow(ctx, `INSERT INTO plan_items (plan_id, week, day_of_week, item_type, title, details)
		VALUES ($1, 4, 2, 'run', 'Easy 6k', '{"distance_km": 6}') RETURNING id`, plan).Scan(&next); err != nil {
		t.Fatal(err)
	}

	st := store.NewTrainingStore(pool)
	sessions := training.NewSessions(st, cannedAI{text: `{"message":"Well done.","flag":"caution"}`})
	in := training.SessionInput{PlanItemID: run, Sport: "run", RPE: ptrTo(7), DistanceKm: ptrTo(6.5)}

	// Bob can't log Ada's session.
	if _, err := sessions.LogSession(ctx, bob, in); appKind(err) != apperr.NotFound {
		t.Fatalf("bob: %v", err)
	}
	logged, err := sessions.LogSession(ctx, ada, in)
	if err != nil || logged.AwardedXP != 10 || logged.Feedback.Flag != "caution" {
		t.Fatalf("log = %+v, %v", logged, err)
	}
	if _, err := sessions.LogSession(ctx, ada, in); appKind(err) != apperr.Conflict {
		t.Fatalf("second log: %v", err)
	}
	var (
		done     bool
		feedback string
		xp       int
	)
	if err := owner.QueryRow(ctx, `SELECT i.is_completed, l.ai_feedback::text, p.xp
		FROM plan_items i JOIN session_logs l ON l.plan_item_id = i.id JOIN profiles p ON p.id = l.user_id
		WHERE i.id = $1`, run).Scan(&done, &feedback, &xp); err != nil {
		t.Fatal(err)
	}
	if !done || feedback != `{"flag": "caution", "message": "Well done."}` || xp != 10 {
		t.Fatalf("done=%v feedback=%s xp=%d", done, feedback, xp)
	}

	// Check-in: week 3 reviewed from the log, week 4 rewritten.
	checkins := training.NewCheckins(st, cannedAI{}, now)
	if _, err := checkins.Proposal(ctx, bob, plan); appKind(err) != apperr.NotFound {
		t.Fatalf("bob proposal: %v", err)
	}
	proposal, err := checkins.Proposal(ctx, ada, plan)
	if err != nil {
		t.Fatal(err)
	}
	c := proposal.Scorecard
	if proposal.ReviewWeek != 3 || c.CompletedItems != 1 || c.ActualKm != 6.5 || len(c.CautionFlags) != 1 || proposal.Decision != "advance" {
		t.Fatalf("proposal = %+v", proposal)
	}
	confirmed, err := checkins.Confirm(ctx, ada, training.CheckinInput{
		PlanID: plan, CheckinWeek: 3, Summary: "Onwards", Items: []aigen.PlanItemInput{
			{DayOfWeek: 1, ItemType: "run", Title: "Easy 7k", Details: aigen.ItemDetails{DistanceKm: ptrTo(7.0)}},
			{DayOfWeek: 4, ItemType: "stretch", Title: "Mobility"},
		},
	})
	if err != nil || confirmed.AwardedXP != 20 {
		t.Fatalf("confirm = %+v, %v", confirmed, err)
	}
	var week4, oldGone int
	if err := owner.QueryRow(ctx, `SELECT count(*) FILTER (WHERE week = 4), count(*) FILTER (WHERE id = $2)
		FROM plan_items WHERE plan_id = $1`, plan, next).Scan(&week4, &oldGone); err != nil {
		t.Fatal(err)
	}
	if week4 != 2 || oldGone != 0 {
		t.Fatalf("week 4 items = %d, old item left = %d", week4, oldGone)
	}
	if _, err := checkins.Proposal(ctx, ada, plan); appKind(err) != apperr.NotFound {
		t.Fatalf("reviewed week still due: %v", err)
	}
	_, err = st.ApplyWeekAdjustment(ctx, ada, training.WeekAdjustment{
		PlanID: plan, CheckinWeek: 3, TargetWeek: 4, Decision: "advance", Items: []aigen.PlanItemInput{{Week: 4, ItemType: "run", Title: "x"}},
	})
	if !errors.Is(err, training.ErrAlreadyCheckedIn) {
		t.Fatalf("repeat apply: %v", err)
	}
}

func ptrTo[T any](v T) *T { return &v }
