-- name: GetBodyProfile :one
SELECT birth_date, sex, height_cm, training_history, country, weight_kg, body_fat_pct, nutrition_sharing_enabled
FROM public.profiles WHERE id = sqlc.arg(user_id);

-- name: UpdateBodyProfile :exec
UPDATE public.profiles
SET birth_date = CAST(sqlc.narg(birth_date)::text AS date), sex = sqlc.narg(sex)::text,
    height_cm = sqlc.narg(height_cm)::float8, training_history = sqlc.narg(training_history)::text,
    country = sqlc.narg(country)::text
WHERE id = sqlc.arg(user_id);

-- name: SetNutritionSharing :exec
UPDATE public.profiles SET nutrition_sharing_enabled = sqlc.arg(enabled) WHERE id = sqlc.arg(user_id);

-- name: ProfileOverview :one
SELECT u.created_at AS joined_at, p.avatar_url,
       (SELECT count(*) FROM public.logs l WHERE l.user_id = p.id AND l.status = 'completed')::int AS workout_count
FROM public.profiles p JOIN public.users u ON u.id = p.id
WHERE p.id = sqlc.arg(user_id);

-- name: RecentXP :many
SELECT id, amount, reason, created_at FROM public.xp_transactions
WHERE user_id = sqlc.arg(user_id)
ORDER BY created_at DESC
LIMIT sqlc.arg(max_rows)::int;

-- name: ListMeasurements :many
SELECT id, measured_at::text AS measured_at, weight_kg, body_fat_pct FROM public.body_measurements
WHERE user_id = sqlc.arg(user_id)
ORDER BY measured_at DESC, created_at DESC
LIMIT sqlc.arg(max_rows)::int;

-- name: ListSessionLogsSince :many
SELECT created_at, sport, actual FROM public.session_logs
WHERE user_id = sqlc.arg(user_id) AND created_at >= sqlc.arg(since)::timestamptz
ORDER BY created_at;

-- name: InsertMeasurement :exec
INSERT INTO public.body_measurements (user_id, weight_kg, body_fat_pct)
VALUES (sqlc.arg(user_id), sqlc.narg(weight_kg)::float8, sqlc.narg(body_fat_pct)::float8);

-- name: RefreshMeasurementSnapshot :exec
UPDATE public.profiles
SET weight_kg = COALESCE(sqlc.narg(weight_kg)::float8, weight_kg),
    body_fat_pct = COALESCE(sqlc.narg(body_fat_pct)::float8, body_fat_pct)
WHERE id = sqlc.arg(user_id);

-- name: LockActiveMeasurementGoals :many
SELECT id, goal_type, target_value, start_value FROM public.goals
WHERE user_id = sqlc.arg(user_id) AND status = 'active' AND goal_type IN ('weight', 'body_fat_pct')
ORDER BY created_at
FOR UPDATE;

-- name: SetGoalStart :exec
UPDATE public.goals SET start_value = sqlc.arg(start_value)::float8
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: MarkGoalAchieved :execrows
-- Only an active goal settles (0 rows: already settled).
UPDATE public.goals SET status = 'achieved', achieved_at = now()
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id) AND status = 'active';

-- name: DeleteMeasurement :execrows
DELETE FROM public.body_measurements WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: ListGoals :many
SELECT id, goal_type, target_value, start_value, target_date, status, achieved_at, created_at
FROM public.goals
WHERE user_id = sqlc.arg(user_id)
ORDER BY created_at DESC;

-- name: LatestMeasurementValues :one
-- The newest non-null weight / body fat among the last 10 readings, falling
-- back to the profile snapshot (legacy getGoalsWithProgress).
SELECT
  COALESCE((SELECT m.weight_kg FROM (SELECT weight_kg, measured_at, created_at FROM public.body_measurements bm
             WHERE bm.user_id = p.id ORDER BY measured_at DESC, created_at DESC LIMIT 10) m
            WHERE m.weight_kg IS NOT NULL ORDER BY m.measured_at DESC, m.created_at DESC LIMIT 1), p.weight_kg) AS weight_kg,
  COALESCE((SELECT m.body_fat_pct FROM (SELECT body_fat_pct, measured_at, created_at FROM public.body_measurements bm
             WHERE bm.user_id = p.id ORDER BY measured_at DESC, created_at DESC LIMIT 10) m
            WHERE m.body_fat_pct IS NOT NULL ORDER BY m.measured_at DESC, m.created_at DESC LIMIT 1), p.body_fat_pct) AS body_fat_pct
FROM public.profiles p WHERE p.id = sqlc.arg(user_id);

-- name: KcalOn :one
SELECT COALESCE(sum(kcal), 0)::float8 AS kcal FROM public.meal_logs
WHERE user_id = sqlc.arg(user_id) AND date = CAST(sqlc.arg(on_date)::text AS date);

-- name: InsertGoal :exec
INSERT INTO public.goals (user_id, goal_type, target_value, start_value, target_date)
VALUES (sqlc.arg(user_id), sqlc.arg(goal_type)::text, sqlc.arg(target_value)::float8, sqlc.narg(start_value)::float8,
        CAST(sqlc.narg(target_date)::text AS date));

-- name: AbandonGoal :execrows
UPDATE public.goals SET status = 'abandoned'
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id) AND status = 'active';
