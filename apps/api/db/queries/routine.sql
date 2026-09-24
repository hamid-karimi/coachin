-- "My week": sport types, fixed sessions (schedules), weekly targets (quotas),
-- and the active plan's items. Run with the coachin_app pool inside
-- store.WithUser; every user-owned query also filters by user_id explicitly.

-- name: ListSportTypes :many
SELECT id, name, xp_multiplier
FROM public.sport_types
WHERE name IS NOT NULL
ORDER BY id;

-- name: SportTypeExists :one
SELECT EXISTS (SELECT 1 FROM public.sport_types WHERE id = sqlc.arg(id));

-- name: ListSchedules :many
SELECT s.id, s.sport_type_id, st.name AS sport_name, s.day_of_week, s."time", s.ends_on,
       st.xp_multiplier
FROM public.schedules s
LEFT JOIN public.sport_types st ON st.id = s.sport_type_id
WHERE s.user_id = sqlc.arg(user_id)::uuid
ORDER BY s.day_of_week, s."time" NULLS LAST, s.created_at, s.id;

-- name: InsertSchedule :exec
INSERT INTO public.schedules (user_id, sport_type_id, day_of_week, "time", ends_on)
VALUES (sqlc.arg(user_id)::uuid, sqlc.arg(sport_type_id)::bigint, sqlc.arg(day_of_week),
        CAST(sqlc.narg(time)::text AS time), CAST(sqlc.narg(ends_on)::text AS date));

-- name: DeleteSchedule :execrows
DELETE FROM public.schedules WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id)::uuid;

-- name: ListQuotas :many
SELECT q.id, q.sport_type_id, st.name AS sport_name, q.sessions_per_week
FROM public.weekly_quotas q
LEFT JOIN public.sport_types st ON st.id = q.sport_type_id
WHERE q.user_id = sqlc.arg(user_id)
ORDER BY q.created_at, q.id;

-- name: UpsertQuota :exec
INSERT INTO public.weekly_quotas (user_id, sport_type_id, sessions_per_week)
VALUES (sqlc.arg(user_id), sqlc.arg(sport_type_id), sqlc.arg(sessions_per_week))
ON CONFLICT (user_id, sport_type_id) DO UPDATE SET sessions_per_week = EXCLUDED.sessions_per_week;

-- name: DeleteQuota :execrows
DELETE FROM public.weekly_quotas WHERE sport_type_id = sqlc.arg(sport_type_id) AND user_id = sqlc.arg(user_id);

-- name: ListLogsBetween :many
SELECT sport_type_id, date::text AS date, status::text AS status
FROM public.logs
WHERE user_id = sqlc.arg(user_id)::uuid
  AND date BETWEEN CAST(sqlc.arg(from_date)::text AS date) AND CAST(sqlc.arg(to_date)::text AS date);

-- name: LatestActivePlan :one
-- A user may hold several active plans (one per discipline); the week view
-- shows the newest, as the legacy page did.
SELECT id, created_at, weeks_total
FROM public.training_plans
WHERE user_id = sqlc.arg(user_id) AND status = 'active'
ORDER BY created_at DESC
LIMIT 1;

-- name: ListPlanWeekItems :many
SELECT i.id, i.day_of_week, i.item_type, i.title, i.description, i.details, i.is_completed
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE i.plan_id = sqlc.arg(plan_id) AND p.user_id = sqlc.arg(user_id) AND i.week = sqlc.arg(week)
ORDER BY i.day_of_week, i.id;
