package store_test

import (
	"context"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/hamid-karimi/coachin/apps/api/internal/app/calendar"
	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/aigen"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestMealPlanOnPostgres(t *testing.T) {
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
	st := store.NewNutritionStore(pool)
	ada := seedUser(t, owner, "ada@example.com")
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	exec(`UPDATE profiles SET sex = 'female', birth_date = '1994-03-10', height_cm = 168, weight_kg = 62.5, country = 'Iran' WHERE id = $1`, ada)
	exec(`INSERT INTO schedules (user_id, day_of_week) VALUES ($1, 1), ($1, 1), ($1, 4)`, ada)
	exec(`INSERT INTO body_photos (user_id, storage_path, kind, analysis, analyzed_at) VALUES ($1, 'p', 'body_photo', '{"build_notes":"Lean"}', now())`, ada)

	prof, err := st.PlanProfile(ctx, ada)
	if err != nil || *prof.BirthDate != "1994-03-10" || *prof.WeightKg != 62.5 || *prof.Country != "Iran" {
		t.Fatalf("profile = %+v, %v", prof, err)
	}
	if days, _ := st.TrainingDaysPerWeek(ctx, ada); days != 2 {
		t.Errorf("training days = %d", days)
	}
	if raw, _ := st.BodyAnalysis(ctx, ada); string(raw) != `{"build_notes": "Lean"}` {
		t.Errorf("analysis = %s", raw)
	}
	if has, _ := st.HasActiveTrainingPlan(ctx, ada); has {
		t.Error("no training plan yet")
	}
	if plan, err := st.ActiveMealPlan(ctx, ada); err != nil || plan != nil {
		t.Fatalf("no plan yet: %+v, %v", plan, err)
	}

	meal := func(day int, mealType, title string, kcal float64) aigen.PlannedMeal {
		return aigen.PlannedMeal{DayOfWeek: day, MealType: mealType, Title: title, Kcal: kcal, VideoQuery: title,
			Ingredients: []nutrition.Ingredient{{Name: "Oats", Qty: "80 g"}}}
	}
	save := func(kcal float64, meals ...aigen.PlannedMeal) {
		t.Helper()
		err := st.SaveMealPlan(ctx, ada, appnutrition.NewMealPlan{
			Intake:  appnutrition.PlanIntake{Goal: "lose", Diet: "vegan", Allergies: []string{"peanuts"}, Dislikes: []string{}, MealsPerDay: 3},
			Targets: nutrition.Targets{Kcal: kcal, ProteinG: 130, CarbsG: 200, FatG: 60},
			Meals:   meals,
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	goalTarget := func() float64 {
		var v float64
		if err := owner.QueryRow(ctx, `SELECT target_value::float8 FROM goals WHERE user_id = $1 AND goal_type = 'calorie_intake' AND status = 'active'`, ada).Scan(&v); err != nil {
			t.Fatal(err)
		}
		return v
	}

	save(1800, meal(3, "breakfast", "Old", 500))
	if goalTarget() != 1800 {
		t.Errorf("goal = %v", goalTarget())
	}
	save(1900, meal(3, "breakfast", "Oats", 450), meal(3, "dinner", "Stew", 700), meal(5, "lunch", "Salad", 500))
	var active, goals int
	_ = owner.QueryRow(ctx, `SELECT count(*) FILTER (WHERE status = 'active') FROM meal_plans WHERE user_id = $1`, ada).Scan(&active)
	_ = owner.QueryRow(ctx, `SELECT count(*) FROM goals WHERE user_id = $1`, ada).Scan(&goals)
	if active != 1 || goals != 1 || goalTarget() != 1900 {
		t.Errorf("active plans %d, goals %d, target %v", active, goals, goalTarget())
	}

	plan, err := st.ActiveMealPlan(ctx, ada)
	if err != nil || plan.Targets.Kcal != 1900 || plan.Intake.Diet != "vegan" || len(plan.Items) != 3 ||
		plan.Items[0].Title != "Oats" || plan.Items[0].Ingredients[0].Qty != "80 g" {
		t.Fatalf("plan = %+v, %v", plan, err)
	}

	day, err := store.NewTodayStore(pool).MealPlanDay(ctx, ada, 3)
	if err != nil || day.KcalTarget != 1900 || len(day.Meals) != 2 || day.Meals[1].Title != "Stew" {
		t.Fatalf("today menu = %+v, %v", day, err)
	}

	// Calendar: Wed 2026-09-23 has a logged breakfast.
	exec(`INSERT INTO meal_logs (user_id, date, meal_type, kcal) VALUES ($1, '2026-09-23', 'breakfast', 480)`, ada)
	now := func() time.Time { return time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC) }
	week, err := calendar.NewService(store.NewCalendarStore(pool), now).Week(ctx, ada, "")
	if err != nil {
		t.Fatal(err)
	}
	wed, fri := week.Days[2].Meals, week.Days[4].Meals
	if wed == nil || wed.PlannedCount != 2 || wed.Adherence.SlotsLogged != 1 || wed.Adherence.KcalLogged != 480 {
		t.Errorf("wednesday = %+v", wed)
	}
	if fri == nil || fri.PlannedKcal != 500 || fri.Adherence != nil {
		t.Errorf("friday = %+v", fri)
	}

	if err := st.ArchiveMealPlan(ctx, ada); err != nil {
		t.Fatal(err)
	}
	if plan, _ := st.ActiveMealPlan(ctx, ada); plan != nil {
		t.Error("plan still active after discard")
	}
	if day, _ := store.NewTodayStore(pool).MealPlanDay(ctx, ada, 3); day != nil {
		t.Error("today menu without a plan")
	}
}
