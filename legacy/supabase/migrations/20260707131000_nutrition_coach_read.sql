-- Trainee-controlled nutrition sharing with the coach (ranked improvements
-- phase 5). Owner decision: sharing grants the coach FULL read access to the
-- trainee's meal logs and meal plans — but only while the trainee's opt-in
-- flag is on, and never any write access.
--
-- SELECT policies copy the coach-read pattern from
-- 20260704120000_logs_policies_coach_read.sql, with an additional AND on the
-- owner's profiles.nutrition_sharing_enabled. INSERT/UPDATE/DELETE policies
-- are untouched (self-only).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nutrition_sharing_enabled boolean NOT NULL DEFAULT false;

-- meal_logs ------------------------------------------------------------------
DROP POLICY IF EXISTS meal_logs_select_self ON public.meal_logs;
DROP POLICY IF EXISTS meal_logs_select_self_or_coach ON public.meal_logs;
CREATE POLICY meal_logs_select_self_or_coach
ON public.meal_logs
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.status = 'active'
        AND cr.coach_id = auth.uid()
        AND cr.student_id = meal_logs.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = meal_logs.user_id
        AND p.nutrition_sharing_enabled
    )
  )
);

-- meal_plans -----------------------------------------------------------------
DROP POLICY IF EXISTS meal_plans_select_self ON public.meal_plans;
DROP POLICY IF EXISTS meal_plans_select_self_or_coach ON public.meal_plans;
CREATE POLICY meal_plans_select_self_or_coach
ON public.meal_plans
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.status = 'active'
        AND cr.coach_id = auth.uid()
        AND cr.student_id = meal_plans.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = meal_plans.user_id
        AND p.nutrition_sharing_enabled
    )
  )
);

-- meal_plan_items ------------------------------------------------------------
DROP POLICY IF EXISTS meal_plan_items_select_self ON public.meal_plan_items;
DROP POLICY IF EXISTS meal_plan_items_select_self_or_coach ON public.meal_plan_items;
CREATE POLICY meal_plan_items_select_self_or_coach
ON public.meal_plan_items
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.status = 'active'
        AND cr.coach_id = auth.uid()
        AND cr.student_id = meal_plan_items.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = meal_plan_items.user_id
        AND p.nutrition_sharing_enabled
    )
  )
);
