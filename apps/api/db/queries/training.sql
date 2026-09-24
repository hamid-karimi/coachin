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
