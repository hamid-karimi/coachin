package store_test

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/training"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestCreatePlanOnPostgres(t *testing.T) {
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

	ada, coach := seedUser(t, owner, "ada@example.com"), seedUser(t, owner, "coach@example.com")
	if _, err := owner.Exec(ctx, `UPDATE profiles SET role = 'coach' WHERE id = $1`, coach); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, `UPDATE profiles SET height_cm = 168.5, weight_kg = 61.00, birth_date = '1990-01-15', sex = 'female'
		WHERE id = $1`, ada); err != nil {
		t.Fatal(err)
	}
	if _, err := owner.Exec(ctx, `INSERT INTO schedules (user_id, day_of_week, sport_type_id, "time")
		SELECT $1, 2, id, '19:00' FROM sport_types WHERE name = 'Football'`, ada); err != nil {
		t.Fatal(err)
	}
	st := store.NewTrainingStore(pool)
	items := []aigen.PlanItemInput{{Week: 1, DayOfWeek: 1, ItemType: "run", Title: "Easy run", Details: aigen.ItemDetails{DistanceKm: ptr(5.0)}}}
	plan := func(kind string) training.NewPlan {
		return training.NewPlan{PlanKind: kind, WeeksTotal: 8, Summary: "S", Intake: json.RawMessage(`{"plan_kind":"` + kind + `"}`),
			Raw: json.RawMessage(`{}`), Model: "m", Items: items}
	}

	athlete, err := st.Athlete(ctx, ada, ada)
	if err != nil || *athlete.HeightCm != 168.5 || *athlete.WeightKg != 61 || *athlete.BirthDate != "1990-01-15" {
		t.Fatalf("athlete = %+v, %v", athlete, err)
	}
	anchors, err := st.Anchors(ctx, ada, ada, time.Now().UTC().Format("2006-01-02"))
	if err != nil || len(anchors) != 1 || *anchors[0].Time != "19:00:00" || anchors[0].Sport != "Football" {
		t.Fatalf("anchors = %+v, %v", anchors, err)
	}

	first, err := st.CreatePlan(ctx, ada, plan("race"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.CreatePlan(ctx, ada, plan("hypertrophy")); err != nil {
		t.Fatal(err)
	}
	second, err := st.CreatePlan(ctx, ada, plan("race")) // replaces the first race plan only
	if err != nil {
		t.Fatal(err)
	}
	var active int
	var firstStatus string
	_ = owner.QueryRow(ctx, "SELECT count(*) FROM training_plans WHERE user_id = $1 AND status = 'active'", ada).Scan(&active)
	_ = owner.QueryRow(ctx, "SELECT status FROM training_plans WHERE id = $1", first).Scan(&firstStatus)
	var details string
	_ = owner.QueryRow(ctx, "SELECT details::text FROM plan_items WHERE plan_id = $1", second).Scan(&details)
	if active != 2 || firstStatus != "archived" || details != `{"distance_km": 5}` {
		t.Fatalf("active %d, first %s, details %s", active, firstStatus, details)
	}

	// Coach mode needs an active relationship (the SQL function re-checks it).
	target := plan("race")
	target.Target = &ada
	if _, err := st.CreatePlan(ctx, coach, target); err == nil {
		t.Fatal("coach without relationship saved a plan")
	}
	if _, err := owner.Exec(ctx, "INSERT INTO coaching_relationships (coach_id, student_id) VALUES ($1, $2)", coach, ada); err != nil {
		t.Fatal(err)
	}
	if ok, _ := st.Coaches(ctx, coach, ada); !ok {
		t.Fatal("relationship not seen")
	}
	coachPlan, err := st.CreatePlan(ctx, coach, target)
	if err != nil {
		t.Fatal(err)
	}
	var owned, createdBy uuid.UUID
	_ = owner.QueryRow(ctx, "SELECT user_id, created_by FROM training_plans WHERE id = $1", coachPlan).Scan(&owned, &createdBy)
	if owned != ada || createdBy != coach {
		t.Fatalf("coach plan owned by %s, created by %s", owned, createdBy)
	}
	if role, _ := st.Role(ctx, coach); role != "coach" {
		t.Fatalf("role = %q", role)
	}
}

func ptr[T any](v T) *T { return &v }
