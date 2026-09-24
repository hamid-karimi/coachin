-- Daily stack: supplements and their taken-today logs. FORMULAS.md §13 —
-- informational only (never XP, streaks, or hearts).

-- name: ListSupplements :many
SELECT id, name, dose, schedule_type, days_of_week::int[] AS days_of_week
FROM public.supplements
WHERE user_id = sqlc.arg(user_id)
ORDER BY created_at, id;

-- name: ListTakenSupplementsOn :many
SELECT supplement_id
FROM public.supplement_logs
WHERE user_id = sqlc.arg(user_id) AND date = CAST(sqlc.arg(on_date)::text AS date);

-- name: HasAnySchedule :one
SELECT EXISTS (SELECT 1 FROM public.schedules WHERE user_id = sqlc.arg(user_id)::uuid);

-- name: CountSupplements :one
SELECT count(*)::int FROM public.supplements WHERE user_id = sqlc.arg(user_id);

-- name: InsertSupplement :exec
INSERT INTO public.supplements (user_id, name, dose, schedule_type, days_of_week)
VALUES (sqlc.arg(user_id), sqlc.arg(name), sqlc.narg(dose), sqlc.arg(schedule_type), sqlc.narg(days_of_week)::smallint[]);

-- name: UpdateSupplementSchedule :execrows
UPDATE public.supplements
SET schedule_type = sqlc.arg(schedule_type), days_of_week = sqlc.narg(days_of_week)::smallint[]
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: DeleteSupplement :exec
DELETE FROM public.supplements WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: SupplementOwned :one
SELECT EXISTS (SELECT 1 FROM public.supplements WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id));

-- name: LogSupplementTaken :exec
-- A double tap is fine: one row per supplement per day.
INSERT INTO public.supplement_logs (user_id, supplement_id, date)
VALUES (sqlc.arg(user_id), sqlc.arg(supplement_id), CAST(sqlc.arg(on_date)::text AS date))
ON CONFLICT (supplement_id, date) DO NOTHING;

-- name: UnlogSupplementTaken :exec
DELETE FROM public.supplement_logs
WHERE supplement_id = sqlc.arg(supplement_id) AND user_id = sqlc.arg(user_id)
  AND date = CAST(sqlc.arg(on_date)::text AS date);
