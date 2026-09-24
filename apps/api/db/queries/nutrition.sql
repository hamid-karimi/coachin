-- Nutrition: meal logs, foods, and meal XP.
-- Run with the coachin_app pool inside store.WithUser.

-- name: ListMealsOn :many
SELECT id, meal_type, free_text, quantity_g, kcal::float8 AS kcal,
       protein_g::float8 AS protein_g, carbs_g::float8 AS carbs_g, fat_g::float8 AS fat_g,
       sugar_g::float8 AS sugar_g, fiber_g::float8 AS fiber_g, sodium_mg::float8 AS sodium_mg, entry_method
FROM public.meal_logs
WHERE user_id = sqlc.arg(user_id)::uuid AND date = CAST(sqlc.arg(on_date)::text AS date)
ORDER BY created_at, id;

-- name: ListMealNutrientsSince :many
SELECT date::text AS date, kcal::float8 AS kcal, protein_g::float8 AS protein_g, carbs_g::float8 AS carbs_g,
       fat_g::float8 AS fat_g, sugar_g::float8 AS sugar_g, fiber_g::float8 AS fiber_g, sodium_mg::float8 AS sodium_mg
FROM public.meal_logs
WHERE user_id = sqlc.arg(user_id)::uuid AND date >= CAST(sqlc.arg(from_date)::text AS date);

-- name: SearchFoods :many
-- Local food search, ordered by source as the legacy app (custom, seed, usda), then name.
SELECT id, name, kcal_per_100g::float8 AS kcal_per_100g, protein_g::float8 AS protein_g, carbs_g::float8 AS carbs_g,
       fat_g::float8 AS fat_g, COALESCE(sugar_g, 0)::float8 AS sugar_g, COALESCE(fiber_g, 0)::float8 AS fiber_g,
       COALESCE(sodium_mg, 0)::float8 AS sodium_mg, source
FROM public.foods
WHERE name ILIKE '%' || sqlc.arg(pattern)::text || '%' ESCAPE '\'
ORDER BY source, name, id
LIMIT 8;

-- name: GetFood :one
SELECT id, name, kcal_per_100g::float8 AS kcal_per_100g, protein_g::float8 AS protein_g, carbs_g::float8 AS carbs_g,
       fat_g::float8 AS fat_g, COALESCE(sugar_g, 0)::float8 AS sugar_g, COALESCE(fiber_g, 0)::float8 AS fiber_g,
       COALESCE(sodium_mg, 0)::float8 AS sodium_mg, source
FROM public.foods
WHERE id = sqlc.arg(id);

-- name: InsertUSDAFood :exec
-- One shared row per USDA food; a second save of the same food is a no-op.
INSERT INTO public.foods (name, kcal_per_100g, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, source, created_by, fdc_id)
VALUES (sqlc.arg(name)::text, sqlc.arg(kcal)::float8, sqlc.arg(protein_g)::float8, sqlc.arg(carbs_g)::float8,
        sqlc.arg(fat_g)::float8, sqlc.arg(sugar_g)::float8, sqlc.arg(fiber_g)::float8, sqlc.arg(sodium_mg)::float8,
        'usda', sqlc.arg(user_id)::uuid, sqlc.arg(fdc_id)::int)
ON CONFLICT (fdc_id) WHERE fdc_id IS NOT NULL DO NOTHING;

-- name: GetFoodByFdcID :one
SELECT id, name, kcal_per_100g::float8 AS kcal_per_100g, protein_g::float8 AS protein_g, carbs_g::float8 AS carbs_g,
       fat_g::float8 AS fat_g, COALESCE(sugar_g, 0)::float8 AS sugar_g, COALESCE(fiber_g, 0)::float8 AS fiber_g,
       COALESCE(sodium_mg, 0)::float8 AS sodium_mg, source
FROM public.foods
WHERE fdc_id = sqlc.arg(fdc_id)::int;

-- name: InsertMealLog :one
-- clock_timestamp keeps a batch (photo items) in its order.
INSERT INTO public.meal_logs (user_id, date, meal_type, food_id, free_text, quantity_g, kcal, protein_g, carbs_g, fat_g,
                              sugar_g, fiber_g, sodium_mg, entry_method, photo_estimate, created_at)
VALUES (sqlc.arg(user_id)::uuid, CAST(sqlc.arg(on_date)::text AS date), sqlc.arg(meal_type)::text, sqlc.narg(food_id)::uuid,
        sqlc.arg(free_text)::text, sqlc.narg(quantity_g)::float8, sqlc.arg(kcal)::float8, sqlc.arg(protein_g)::float8,
        sqlc.arg(carbs_g)::float8, sqlc.arg(fat_g)::float8, sqlc.arg(sugar_g)::float8, sqlc.arg(fiber_g)::float8,
        sqlc.arg(sodium_mg)::float8, sqlc.arg(entry_method)::text, sqlc.narg(photo_estimate)::jsonb, clock_timestamp())
RETURNING id;

-- name: AwardMealXP :one
-- Step A (ADR-5): +5 once per log, at most 3 awarded logs per date.
SELECT public.award_meal_xp(sqlc.arg(meal_log_id))::text AS result;

-- name: AwardDayAdherence :one
-- Step A (ADR-5): +30 once for a past day within ±10% of the calorie goal (2+ meals).
SELECT public.award_day_adherence(CAST(sqlc.arg(on_date)::text AS date))::text AS result;

-- name: DeleteMealLog :execrows
DELETE FROM public.meal_logs WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: MealXPOutstanding :one
-- XP a meal log earned and hasn't given back (0 or 5).
SELECT COALESCE(SUM(amount), 0)::int AS xp
FROM public.xp_transactions
WHERE user_id = sqlc.arg(user_id)::uuid
  AND reason IN ('meal_log:' || sqlc.arg(meal_log_id)::text, 'meal_log_undo:' || sqlc.arg(meal_log_id)::text);

-- name: ProfileCountry :one
SELECT country FROM public.profiles WHERE id = sqlc.arg(id);
