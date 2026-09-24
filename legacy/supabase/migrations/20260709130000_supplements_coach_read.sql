-- Coach read access to the trainee's daily stack (adherence + supplements,
-- phase B). Owner decision: the supplement stack is nutrition-adjacent, so it
-- reuses the same consent flag as meals — a coach gets READ-ONLY access to the
-- trainee's supplements and supplement_logs, but only while the trainee's
-- profiles.nutrition_sharing_enabled is on. No separate supplements consent
-- flag; no coach write access.
--
-- SELECT policies copy the coach-read pattern from
-- 20260707131000_nutrition_coach_read.sql (active coaching_relationships AND an
-- EXISTS on profiles.nutrition_sharing_enabled). INSERT/DELETE stay self-only.

-- supplements ----------------------------------------------------------------
DROP POLICY IF EXISTS supplements_select_self ON public.supplements;
DROP POLICY IF EXISTS supplements_select_self_or_coach ON public.supplements;
CREATE POLICY supplements_select_self_or_coach
ON public.supplements
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
        AND cr.student_id = supplements.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = supplements.user_id
        AND p.nutrition_sharing_enabled
    )
  )
);

-- supplement_logs ------------------------------------------------------------
DROP POLICY IF EXISTS supplement_logs_select_self ON public.supplement_logs;
DROP POLICY IF EXISTS supplement_logs_select_self_or_coach ON public.supplement_logs;
CREATE POLICY supplement_logs_select_self_or_coach
ON public.supplement_logs
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
        AND cr.student_id = supplement_logs.user_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = supplement_logs.user_id
        AND p.nutrition_sharing_enabled
    )
  )
);
