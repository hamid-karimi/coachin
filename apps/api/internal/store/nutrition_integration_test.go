package store_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"

	appnutrition "github.com/hamid-karimi/coachin/apps/api/internal/app/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/domain/nutrition"
	"github.com/hamid-karimi/coachin/apps/api/internal/store"
)

func TestNutritionOnPostgres(t *testing.T) {
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

	ada, bob := seedUser(t, owner, "ada@example.com"), seedUser(t, owner, "bob@example.com")
	var today, yesterday string
	if err := owner.QueryRow(ctx, "SELECT CURRENT_DATE::text, (CURRENT_DATE - 1)::text").Scan(&today, &yesterday); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string, args ...any) {
		t.Helper()
		if _, err := owner.Exec(ctx, sql, args...); err != nil {
			t.Fatal(err)
		}
	}
	xpOf := func() int {
		var xp int
		if err := owner.QueryRow(ctx, "SELECT COALESCE(xp, 0) FROM profiles WHERE id = $1", ada).Scan(&xp); err != nil {
			t.Fatal(err)
		}
		return xp
	}

	// Search: seed foods, with LIKE wildcards taken literally.
	foods, err := st.SearchFoods(ctx, ada, "chicken")
	if err != nil || len(foods) == 0 || foods[0].Kcal <= 0 {
		t.Fatalf("search = %+v, %v", foods, err)
	}
	// "a%e" would match "Apple" as a pattern; literally it matches nothing.
	if none, _ := st.SearchFoods(ctx, ada, "a%e"); len(none) != 0 {
		t.Errorf("a%%e matched %d foods", len(none))
	}
	if _, err := st.Food(ctx, ada, foods[0].ID); err != nil {
		t.Fatal(err)
	}

	// USDA foods are stored once.
	banana := nutrition.USDAFood{FdcID: 173944, Name: "Bananas, raw", Per100g: nutrition.Per100g{Kcal: 89, CarbsG: 22.8}}
	first, err := st.SaveUSDAFood(ctx, ada, banana)
	if err != nil || first.Source != "usda" || first.Kcal != 89 {
		t.Fatalf("usda food = %+v, %v", first, err)
	}
	if again, _ := st.SaveUSDAFood(ctx, bob, banana); again.ID != first.ID {
		t.Error("a second save created a second row")
	}

	// Yesterday within ±10% of a 1000 kcal goal with 2 meals → +30 once.
	exec(`INSERT INTO goals (user_id, goal_type, target_value) VALUES ($1, 'calorie_intake', 1000)`, ada)
	exec(`INSERT INTO meal_logs (user_id, date, meal_type, kcal) VALUES ($1, $2, 'lunch', 500), ($1, $2, 'dinner', 450)`, ada, yesterday)

	meal := func(kcal float64) appnutrition.NewMeal {
		grams := 100.0
		return appnutrition.NewMeal{MealType: "lunch", FoodID: &first.ID, Name: "Bananas, raw", QuantityG: &grams, EntryMethod: "search",
			Nutrients: nutrition.Nutrients{Kcal: kcal}}
	}
	awards, err := st.LogMeals(ctx, ada, today, yesterday, []appnutrition.NewMeal{meal(89), meal(90), meal(91)}, appnutrition.DefaultMealRules)
	if err != nil || awards != (appnutrition.Awards{MealXP: 15, Adherence: 30}) {
		t.Fatalf("awards = %+v, %v", awards, err)
	}
	awards, _ = st.LogMeals(ctx, ada, today, yesterday, []appnutrition.NewMeal{meal(92)}, appnutrition.DefaultMealRules)
	if awards != (appnutrition.Awards{Capped: true}) || xpOf() != 45 {
		t.Fatalf("4th meal = %+v, xp %d", awards, xpOf())
	}

	meals, err := st.Meals(ctx, ada, today)
	if err != nil || len(meals) != 4 || *meals[0].QuantityG != 100 || meals[0].Kcal != 89 {
		t.Fatalf("meals = %+v, %v", meals, err)
	}
	if target, _ := st.CalorieTarget(ctx, ada); target == nil || *target != 1000 {
		t.Errorf("target = %v", target)
	}
	if rows, _ := st.NutrientsSince(ctx, ada, yesterday); len(rows) != 6 {
		t.Errorf("trend rows = %d", len(rows))
	}

	// Deleting an awarded meal refunds it; the cap then allows one more award,
	// so the day nets 15 meal XP at most.
	if _, err := st.DeleteMeal(ctx, bob, meals[0].ID); !errors.Is(err, appnutrition.ErrNotFound) {
		t.Errorf("bob deleted ada's meal: %v", err)
	}
	refunded, err := st.DeleteMeal(ctx, ada, meals[0].ID)
	if err != nil || refunded != 5 || xpOf() != 40 {
		t.Fatalf("refund = %d, %v, xp %d", refunded, err, xpOf())
	}
	if refunded, _ := st.DeleteMeal(ctx, ada, meals[3].ID); refunded != 0 {
		t.Errorf("an unawarded meal refunded %d", refunded)
	}
	awards, _ = st.LogMeals(ctx, ada, today, yesterday, []appnutrition.NewMeal{meal(93)}, appnutrition.DefaultMealRules)
	if awards.MealXP != 5 || xpOf() != 45 {
		t.Errorf("re-log = %+v, xp %d", awards, xpOf())
	}
}
