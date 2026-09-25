-- name: UserRole :one
SELECT COALESCE(role, 'student')::text AS role FROM public.profiles WHERE id = sqlc.arg(user_id);

-- name: ListTrainees :many
-- The coach's active relationships (one per sport) with each trainee's public profile.
SELECT p.id, p.email, p.full_name, p.avatar_url, COALESCE(p.xp, 0)::bigint AS xp, COALESCE(p.level, 1)::bigint AS level,
       p.league_tier, p.nutrition_sharing_enabled, cr.sport_type_id, st.name AS sport_name
FROM public.coaching_relationships cr
JOIN public.profiles p ON p.id = cr.student_id
LEFT JOIN public.sport_types st ON st.id = cr.sport_type_id
WHERE cr.coach_id = sqlc.arg(coach_id) AND cr.status = 'active'
ORDER BY cr.created_at;

-- name: TraineeLoggedDates :many
SELECT DISTINCT user_id, date::text AS on_date FROM public.logs
WHERE user_id = ANY(sqlc.arg(ids)::uuid[]) AND status = 'completed'
  AND date BETWEEN CAST(sqlc.arg(from_date)::text AS date) AND CAST(sqlc.arg(to_date)::text AS date);

-- name: TraineeScheduledDays :many
SELECT DISTINCT user_id, day_of_week FROM public.schedules WHERE user_id = ANY(sqlc.arg(ids)::uuid[]);

-- name: TraineeActivePlans :many
SELECT id, user_id, plan_kind, created_at, weeks_total FROM public.training_plans
WHERE user_id = ANY(sqlc.arg(ids)::uuid[]) AND status = 'active';

-- name: PlanItemsInWeeks :many
SELECT plan_id, week, item_type, is_completed, details FROM public.plan_items
WHERE plan_id = ANY(sqlc.arg(plan_ids)::uuid[]) AND week = ANY(sqlc.arg(weeks)::int[]);

-- name: ListInviteCodes :many
SELECT c.code, c.is_active, c.expires_at, c.sport_type_id, st.name AS sport_name
FROM public.coach_invite_codes c LEFT JOIN public.sport_types st ON st.id = c.sport_type_id
WHERE c.coach_id = sqlc.arg(coach_id)
ORDER BY c.updated_at DESC;

-- name: SportExists :one
SELECT EXISTS (SELECT 1 FROM public.sport_types WHERE id = sqlc.arg(id))::bool AS found;

-- name: UpsertInviteCode :exec
INSERT INTO public.coach_invite_codes (coach_id, sport_type_id, code, is_active, expires_at, updated_at)
VALUES (sqlc.arg(coach_id), sqlc.arg(sport_type_id), sqlc.arg(code), true, NULL, now())
ON CONFLICT (coach_id, sport_type_id) DO UPDATE
SET code = EXCLUDED.code, is_active = true, expires_at = NULL, updated_at = now();

-- name: JoinCoachingByCode :one
SELECT public.join_coaching_via_invite_code(sqlc.arg(code))::text;

-- name: AssignCoachSchedule :one
SELECT public.assign_coach_schedule_to_student(sqlc.arg(student_id))::text;

-- name: CoachedTrainee :one
-- The trainee when actively coached by this coach (any sport).
SELECT p.id, p.full_name, p.email, p.nutrition_sharing_enabled
FROM public.coaching_relationships cr JOIN public.profiles p ON p.id = cr.student_id
WHERE cr.coach_id = sqlc.arg(coach_id) AND cr.student_id = sqlc.arg(trainee_id) AND cr.status = 'active'
LIMIT 1;

-- name: TraineeMealsSince :many
SELECT m.id, m.date::text AS on_date, m.meal_type, COALESCE(f.name, NULLIF(m.free_text, ''), 'Logged meal')::text AS label,
       COALESCE(m.kcal, 0)::float8 AS kcal, COALESCE(m.protein_g, 0)::float8 AS protein_g
FROM public.meal_logs m LEFT JOIN public.foods f ON f.id = m.food_id
WHERE m.user_id = sqlc.arg(user_id) AND m.date >= CAST(sqlc.arg(from_date)::text AS date)
ORDER BY m.date DESC, m.created_at;

-- name: TraineeMealPlanTargets :one
SELECT kcal_target::float8 AS kcal, protein_g_target::float8 AS protein_g FROM public.meal_plans
WHERE user_id = sqlc.arg(user_id) AND status = 'active'
LIMIT 1;

-- name: TraineeSupplements :many
SELECT id, name, dose, schedule_type, days_of_week, created_at FROM public.supplements
WHERE user_id = sqlc.arg(user_id) ORDER BY created_at;

-- name: TraineeSupplementLogsSince :many
SELECT supplement_id, date::text AS on_date FROM public.supplement_logs
WHERE user_id = sqlc.arg(user_id) AND date >= CAST(sqlc.arg(from_date)::text AS date);

-- name: TraineeTrainingDays :many
-- Plan items (with their plan's start) and routine days, for the due-day window.
SELECT tp.id AS plan_id, tp.created_at, tp.weeks_total, pi.week, pi.day_of_week
FROM public.training_plans tp JOIN public.plan_items pi ON pi.plan_id = tp.id
WHERE tp.user_id = sqlc.arg(user_id) AND tp.status = 'active';

-- name: TraineeRoutineDays :many
SELECT day_of_week, starts_on, ends_on FROM public.schedules
WHERE user_id = sqlc.arg(user_id);
