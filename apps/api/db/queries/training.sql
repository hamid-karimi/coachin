-- Training plans: plan-item completion (more arrives with the Training module).

-- name: GetPlanItemRef :one
-- The item plus its plan's start, for the log-window check. Owner only.
SELECT i.item_type, i.week, i.day_of_week, i.is_completed, p.created_at AS plan_created_at
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE i.id = sqlc.arg(id) AND p.user_id = sqlc.arg(user_id);

-- name: CompletePlanItem :one
-- Step A (ADR-5): the SQL function toggles the item, writes/removes the
-- linked log, and awards or compensates XP idempotently.
SELECT public.complete_plan_item(sqlc.arg(item_id), sqlc.arg(completed), CAST(sqlc.arg(on_date)::text AS date))::text AS result;

-- name: ListActivePrograms :many
SELECT id, race_date, goal_time, weeks_total, created_at, plan_kind, intake, created_by
FROM public.training_plans
WHERE user_id = sqlc.arg(user_id) AND status = 'active'
ORDER BY plan_kind, created_at;

-- name: ListReviewedWeeks :many
SELECT c.plan_id, c.week
FROM public.weekly_checkins c
JOIN public.training_plans p ON p.id = c.plan_id
WHERE p.user_id = sqlc.arg(user_id) AND c.plan_id = ANY(sqlc.arg(plan_ids)::uuid[]);

-- name: ArchivePlan :execrows
UPDATE public.training_plans SET status = 'archived'
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id) AND status = 'active';

-- name: ListActivePlanItems :many
-- Every item of every active plan, for the calendar export.
SELECT i.id, i.week, i.day_of_week, i.item_type, i.title, i.description, i.details, p.created_at AS plan_created_at
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE p.user_id = sqlc.arg(user_id) AND p.status = 'active'
ORDER BY p.plan_kind, i.week, i.day_of_week, i.id;
