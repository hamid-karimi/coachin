-- Today: stats, today's sessions and plan items, workout logging.
-- Run with the coachin_app pool inside store.WithUser.

-- name: SettleStreak :one
-- Settles every unevaluated past day (idempotent); FORMULAS.md §2.
SELECT public.evaluate_user_streak()::text AS result;

-- name: TodayProfile :one
SELECT COALESCE(xp, 0)::bigint AS xp, COALESCE(current_streak, 0)::int AS current_streak,
       COALESCE(best_streak, 0)::int AS best_streak, COALESCE(hearts, 3)::int AS hearts,
       COALESCE(league_tier, 'bronze')::text AS league_tier
FROM public.profiles
WHERE id = sqlc.arg(user_id);

-- name: LockProfile :exec
-- Serializes a user's XP awards (duplicate checks + balance update).
SELECT 1 FROM public.profiles WHERE id = sqlc.arg(user_id) FOR UPDATE;

-- name: ListSessionsOn :many
-- Fixed sessions on a weekday, inside their starts_on/ends_on window.
SELECT s.id, s.sport_type_id, st.name AS sport_name, s."time", st.xp_multiplier
FROM public.schedules s
LEFT JOIN public.sport_types st ON st.id = s.sport_type_id
WHERE s.user_id = sqlc.arg(user_id)::uuid
  AND s.day_of_week = sqlc.arg(day_of_week)
  AND (s.starts_on IS NULL OR s.starts_on <= CAST(sqlc.arg(on_date)::text AS date))
  AND (s.ends_on IS NULL OR s.ends_on >= CAST(sqlc.arg(on_date)::text AS date))
ORDER BY s."time" NULLS LAST, s.created_at, s.id;

-- name: ListLoggedSportsOn :many
SELECT DISTINCT sport_type_id
FROM public.logs
WHERE user_id = sqlc.arg(user_id)::uuid AND date = CAST(sqlc.arg(on_date)::text AS date)
  AND sport_type_id IS NOT NULL;

-- name: ListActivePlans :many
SELECT id, created_at, weeks_total
FROM public.training_plans
WHERE user_id = sqlc.arg(user_id) AND status = 'active'
ORDER BY plan_kind, created_at;

-- name: ListPlanItemsForWeeks :many
-- Items on one weekday for each (plan, week) pair.
SELECT i.id, i.plan_id, i.week, i.day_of_week, i.item_type, i.title, i.description, i.details, i.is_completed
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE p.user_id = sqlc.arg(user_id) AND i.day_of_week = sqlc.arg(day_of_week)
  -- Parallel arrays: the i-th plan is in its week i (unnests zip in step).
  AND (i.plan_id, i.week) IN (SELECT unnest(sqlc.arg(plan_ids)::uuid[]), unnest(sqlc.arg(weeks)::int[]))
ORDER BY p.plan_kind, p.created_at, i.id;

-- name: LastProgressPhotoAt :one
SELECT created_at
FROM public.body_photos
WHERE user_id = sqlc.arg(user_id) AND kind = 'progress'
ORDER BY created_at DESC
LIMIT 1;

-- name: SportMultiplier :one
SELECT xp_multiplier FROM public.sport_types WHERE id = sqlc.arg(id);

-- name: HasLoggedSportOn :one
SELECT EXISTS (
  SELECT 1 FROM public.logs
  WHERE user_id = sqlc.arg(user_id)::uuid AND sport_type_id = sqlc.arg(sport_type_id)::bigint
    AND date = CAST(sqlc.arg(on_date)::text AS date)
);

-- name: InsertWorkoutLog :exec
INSERT INTO public.logs (user_id, sport_type_id, date, status)
VALUES (sqlc.arg(user_id)::uuid, sqlc.arg(sport_type_id)::bigint, CAST(sqlc.arg(on_date)::text AS date), 'completed');

-- name: InsertXPTransaction :exec
INSERT INTO public.xp_transactions (user_id, amount, reason)
VALUES (sqlc.arg(user_id)::uuid, sqlc.arg(amount), sqlc.arg(reason)::text);

-- name: AddProfileXP :one
-- The league tier follows via the sync_league_tier trigger.
UPDATE public.profiles
SET xp = GREATEST(COALESCE(xp, 0) + sqlc.arg(amount)::int, 0),
    level = FLOOR(GREATEST(COALESCE(xp, 0) + sqlc.arg(amount)::int, 0) / 1000.0) + 1
WHERE id = sqlc.arg(user_id)
RETURNING COALESCE(xp, 0)::bigint AS xp;
