package store_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/apperr"
	appprofile "github.com/hamid-karimi/coachin/apps/api/internal/app/profile"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestProfileOnPostgres(t *testing.T) {
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
	svc := appprofile.NewService(store.NewProfileStore(pool), nil)
	ada := seedUser(t, owner, "ada@example.com")
	bob := seedUser(t, owner, "bob@example.com")
	f := func(v float64) *float64 { return &v }

	// Body profile round trip.
	if _, err := svc.UpdateBody(ctx, ada, appprofile.BodyInput{BirthDate: "1994-03-10", Sex: "female", HeightCm: f(168.5), Country: "Iran"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SetNutritionSharing(ctx, ada, true); err != nil {
		t.Fatal(err)
	}
	body, err := svc.Body(ctx, ada)
	if err != nil || *body.BirthDate != "1994-03-10" || *body.HeightCm != 168.5 || *body.Country != "Iran" || body.TrainingHistory != nil || !body.NutritionSharing {
		t.Fatalf("body = %+v, %v", body, err)
	}

	// A weight goal set before any reading has no start; the first reading is
	// its baseline and pays nothing, the next crossing pays +200.
	if _, err := svc.CreateGoal(ctx, ada, appprofile.GoalInput{Type: "weight", Target: 60}); err != nil {
		t.Fatal(err)
	}
	var dup *apperr.Error
	if _, err := svc.CreateGoal(ctx, ada, appprofile.GoalInput{Type: "weight", Target: 58}); !errors.As(err, &dup) || dup.Kind != apperr.Conflict {
		t.Fatalf("duplicate goal: %v", err)
	}
	logged, err := svc.AddMeasurement(ctx, ada, f(55), nil)
	if err != nil || logged.Message != "Measurement logged." {
		t.Fatalf("baseline reading = %+v, %v", logged, err)
	}
	page, _ := svc.Goals(ctx, ada)
	if g := page.Active[0]; *g.Start != 55 || *g.Current != 55 || g.Progress.Direction != "up" || g.Progress.Achieved {
		t.Fatalf("baselined goal = %+v", g)
	}
	logged, err = svc.AddMeasurement(ctx, ada, f(60.2), f(22))
	if err != nil || logged.Message != "Goal achieved: Weight 60kg! +200 XP" {
		t.Fatalf("crossing = %+v, %v", logged, err)
	}
	var xp int
	_ = owner.QueryRow(ctx, `SELECT xp FROM profiles WHERE id = $1`, ada).Scan(&xp)
	if xp != 200 {
		t.Errorf("xp = %d", xp)
	}
	page, _ = svc.Goals(ctx, ada)
	if len(page.Active) != 0 || len(page.Achieved) != 1 {
		t.Fatalf("after achieve = %+v", page)
	}

	// A new goal starts from the latest reading (60.2 → lose to 58).
	if _, err := svc.CreateGoal(ctx, ada, appprofile.GoalInput{Type: "weight", Target: 58, TargetDate: "2026-12-31"}); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.CreateGoal(ctx, ada, appprofile.GoalInput{Type: "calorie_intake", Target: 2000}); err != nil {
		t.Fatal(err)
	}
	page, _ = svc.Goals(ctx, ada)
	if g := page.Active[1]; *g.Start != 60.2 || g.Progress.Direction != "down" || *g.TargetDate != "2026-12-31" {
		t.Fatalf("new goal = %+v", g)
	}
	if g := page.Active[0]; *g.Current != 0 || g.Start != nil {
		t.Fatalf("calorie goal = %+v", g)
	}
	if msg, err := svc.AbandonGoal(ctx, ada, page.Active[0].ID); err != nil || msg != "Goal removed." {
		t.Fatalf("abandon = %q, %v", msg, err)
	}
	if _, err := svc.AbandonGoal(ctx, bob, page.Active[1].ID); err == nil {
		t.Fatal("bob abandoned ada's goal")
	}

	// Snapshot, progress, overview.
	body, _ = svc.Body(ctx, ada)
	if *body.WeightKg != 60.2 || *body.BodyFatPct != 22 {
		t.Errorf("snapshot = %v / %v", *body.WeightKg, *body.BodyFatPct)
	}
	prog, err := svc.Progress(ctx, ada)
	if err != nil || len(prog.Measurements) != 2 || *prog.Measurements[0].WeightKg != 60.2 || len(prog.Weight) != 2 {
		t.Fatalf("progress = %+v, %v", prog, err)
	}
	overview, err := svc.Overview(ctx, ada)
	if err != nil || overview.JoinedAt.IsZero() || time.Since(overview.JoinedAt) > time.Hour || len(overview.RecentXP) != 1 ||
		overview.RecentXP[0].Label != "goal achieved" || overview.RecentXP[0].Amount != 200 {
		t.Fatalf("overview = %+v, %v", overview, err)
	}
	if _, err := svc.DeleteMeasurement(ctx, bob, prog.Measurements[0].ID); err == nil {
		t.Fatal("bob deleted ada's measurement")
	}
	if msg, err := svc.DeleteMeasurement(ctx, ada, prog.Measurements[0].ID); err != nil || msg != "Measurement deleted." {
		t.Fatalf("delete = %q, %v", msg, err)
	}
}
