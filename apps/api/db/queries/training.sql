-- Training plans: plan-item completion (more arrives with the Training module).

-- name: GetPlanItemRef :one
-- The item plus its plan's start, for the log-window check. Owner only.
SELECT i.item_type, i.week, i.day_of_week, i.is_completed, p.created_at AS plan_created_at
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE i.id = sqlc.arg(id) AND p.user_id = sqlc.arg(user_id);

-- name: PlanItemToToggle :one
-- The item's type and title (the log's note), owner only.
SELECT i.item_type, i.title
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE i.id = sqlc.arg(id) AND p.user_id = sqlc.arg(user_id);

-- name: CountLedgerReasons :one
-- How many award and undo rows an item already has (they repeat by design).
SELECT count(*) FILTER (WHERE reason = sqlc.arg(award_reason)::text) AS awards,
       count(*) FILTER (WHERE reason = sqlc.arg(undo_reason)::text) AS undos
FROM public.xp_transactions
WHERE user_id = sqlc.arg(user_id) AND reason IN (sqlc.arg(award_reason)::text, sqlc.arg(undo_reason)::text);

-- name: SetPlanItemCompletion :exec
UPDATE public.plan_items SET is_completed = sqlc.arg(completed) WHERE id = sqlc.arg(id);

-- name: InsertPlanItemLog :exec
-- The completed item's log, dated the day it was marked done (one per item).
INSERT INTO public.logs (user_id, date, sport_type_id, status, notes, plan_item_id)
VALUES (sqlc.arg(user_id), CAST(sqlc.arg(on_date)::text AS date), NULL, 'completed', sqlc.arg(title), sqlc.arg(plan_item_id))
ON CONFLICT (plan_item_id) WHERE plan_item_id IS NOT NULL DO NOTHING;

-- name: DeletePlanItemLog :exec
DELETE FROM public.logs WHERE user_id = sqlc.arg(user_id) AND plan_item_id = sqlc.arg(plan_item_id);

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

-- name: ProfileRole :one
SELECT COALESCE(role, 'student')::text AS role FROM public.profiles WHERE id = sqlc.arg(id);

-- name: CoachesStudent :one
SELECT EXISTS (
  SELECT 1 FROM public.coaching_relationships
  WHERE coach_id = sqlc.arg(coach_id) AND student_id = sqlc.arg(student_id) AND status = 'active'
);

-- name: AthleteProfile :one
-- numeric as stored: 61.00 reads 61, as the legacy JSON API returned it.
SELECT birth_date, sex, height_cm, weight_kg, training_history, full_name, email
FROM public.profiles WHERE id = sqlc.arg(id);

-- name: ListAnchors :many
-- The athlete's fixed sessions active on a date (max 21, as the legacy app).
SELECT s.day_of_week, s."time", st.name AS sport_name
FROM public.schedules s
LEFT JOIN public.sport_types st ON st.id = s.sport_type_id
WHERE s.user_id = sqlc.arg(user_id)::uuid
  AND (s.starts_on IS NULL OR s.starts_on <= CAST(sqlc.arg(on_date)::text AS date))
  AND (s.ends_on IS NULL OR s.ends_on >= CAST(sqlc.arg(on_date)::text AS date))
ORDER BY s.created_at, s.id
LIMIT 21;

-- name: ActiveCalorieGoal :one
SELECT target_value::float8 AS target_value FROM public.goals
WHERE user_id = sqlc.arg(user_id) AND goal_type = 'calorie_intake' AND status = 'active'
LIMIT 1;

-- name: LatestBodyAnalysis :one
-- Body photos only: a report's extracted metrics are not a body analysis
-- (legacy read any kind, so a newer report hid the analysis from prompts).
SELECT analysis FROM public.body_photos
WHERE user_id = sqlc.arg(user_id) AND kind = 'body_photo' AND analysis IS NOT NULL
ORDER BY analyzed_at DESC NULLS LAST
LIMIT 1;

-- name: CreateTrainingPlan :one
-- Step A (ADR-5): archives the same-discipline plan and saves this one,
-- re-verifying the coaching relationship for coach-generated plans.
SELECT public.create_training_plan(
  CAST(sqlc.narg(race_date)::text AS date), sqlc.narg(goal_time)::text, sqlc.arg(weeks_total)::int,
  sqlc.arg(summary)::text, sqlc.arg(intake)::jsonb, sqlc.arg(raw)::jsonb, sqlc.arg(model)::text,
  sqlc.arg(items)::jsonb, sqlc.arg(plan_kind)::text, sqlc.narg(target_user_id)::uuid
)::text AS result;

-- name: GetSessionItem :one
SELECT i.item_type, i.title, i.details
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE i.id = sqlc.arg(id) AND p.user_id = sqlc.arg(user_id);

-- name: InsertSessionLog :one
INSERT INTO public.session_logs (user_id, plan_item_id, sport, rpe, actual, note)
VALUES (sqlc.arg(user_id), sqlc.arg(plan_item_id), sqlc.arg(sport), sqlc.narg(rpe)::int, sqlc.arg(actual)::jsonb, sqlc.narg(note)::text)
RETURNING id;

-- name: MarkPlanItemCompleted :exec
-- Logging implies the item is done; the log's own +10 XP comes next.
UPDATE public.plan_items i SET is_completed = true
FROM public.training_plans p
WHERE i.id = sqlc.arg(id) AND p.id = i.plan_id AND p.user_id = sqlc.arg(user_id);


-- name: SaveSessionFeedback :exec
UPDATE public.session_logs SET ai_feedback = sqlc.arg(feedback)::jsonb
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: GetActivePlan :one
SELECT id, weeks_total, summary, created_at, intake
FROM public.training_plans
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id) AND status = 'active';

-- name: GetCheckin :one
-- A plan week's check-in, if any (the scorecard feeds the next decision).
SELECT c.scorecard
FROM public.weekly_checkins c
JOIN public.training_plans p ON p.id = c.plan_id
WHERE c.plan_id = sqlc.arg(plan_id) AND c.week = sqlc.arg(week) AND p.user_id = sqlc.arg(user_id);

-- name: ListPlanWeeksItems :many
SELECT i.id, i.week, i.day_of_week, i.item_type, i.title, i.details, i.is_completed
FROM public.plan_items i
JOIN public.training_plans p ON p.id = i.plan_id
WHERE i.plan_id = sqlc.arg(plan_id) AND p.user_id = sqlc.arg(user_id)
  AND i.week BETWEEN sqlc.arg(from_week)::int AND sqlc.arg(to_week)::int
ORDER BY i.week, i.day_of_week, i.id;

-- name: ListSessionLogs :many
SELECT plan_item_id, actual, ai_feedback, note
FROM public.session_logs
WHERE user_id = sqlc.arg(user_id) AND plan_item_id = ANY(sqlc.arg(item_ids)::uuid[]);

-- name: ActivePlanLength :one
SELECT weeks_total FROM public.training_plans
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id) AND status = 'active';

-- name: InsertWeeklyCheckin :exec
-- The unique (plan_id, week) constraint refuses a second check-in of a week.
INSERT INTO public.weekly_checkins (plan_id, week, scorecard, decision, summary)
VALUES (sqlc.arg(plan_id), sqlc.arg(week)::int, sqlc.arg(scorecard)::jsonb, sqlc.arg(decision)::text,
        NULLIF(TRIM(sqlc.narg(summary)::text), ''));

-- name: DeleteWeekItems :exec
-- Week-scoped: both the plan and the week, so no other week can be touched.
DELETE FROM public.plan_items WHERE plan_id = sqlc.arg(plan_id) AND week = sqlc.arg(week)::int;

-- name: InsertWeekItem :exec
INSERT INTO public.plan_items (plan_id, week, day_of_week, item_type, title, details, description)
VALUES (sqlc.arg(plan_id), sqlc.arg(week)::int, sqlc.arg(day_of_week)::smallint, sqlc.arg(item_type)::text,
        LEFT(sqlc.arg(title)::text, 200), sqlc.arg(details)::jsonb, NULLIF(TRIM(LEFT(sqlc.narg(description)::text, 2000)), ''));
