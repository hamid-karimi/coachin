-- Calendar: a Monday–Sunday week on real dates.
-- Run with the coachin_app pool inside store.WithUser.

-- name: ListSchedulesBetween :many
-- Fixed sessions whose starts_on/ends_on window overlaps from..to.
SELECT s.sport_type_id, st.name AS sport_name, s.day_of_week, s."time", s.starts_on, s.ends_on
FROM public.schedules s
LEFT JOIN public.sport_types st ON st.id = s.sport_type_id
WHERE s.user_id = sqlc.arg(user_id)::uuid
  AND (s.starts_on IS NULL OR s.starts_on <= CAST(sqlc.arg(to_date)::text AS date))
  AND (s.ends_on IS NULL OR s.ends_on >= CAST(sqlc.arg(from_date)::text AS date))
ORDER BY s."time" NULLS LAST, s.created_at, s.id;

-- name: ListPlanItemsInWeeks :many
-- Every item of each (plan, week) pair.
SELECT i.id, i.plan_id, i.week, i.day_of_week, i.item_type, i.title, i.description, i.details, i.is_completed
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE p.user_id = sqlc.arg(user_id)
  -- Parallel arrays: the i-th plan is in its week i (unnests zip in step).
  AND (i.plan_id, i.week) IN (SELECT unnest(sqlc.arg(plan_ids)::uuid[]), unnest(sqlc.arg(weeks)::int[]))
ORDER BY p.plan_kind, p.created_at, i.id;
