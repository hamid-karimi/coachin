-- Allow coach-student schedule assignment while keeping RLS active

DROP POLICY IF EXISTS schedules_select_self_or_related ON public.schedules;
CREATE POLICY schedules_select_self_or_related
ON public.schedules
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND (
        (cr.coach_id = auth.uid() AND cr.student_id = schedules.user_id)
        OR (cr.student_id = auth.uid() AND cr.coach_id = schedules.user_id)
      )
  )
);

DROP POLICY IF EXISTS schedules_insert_self_or_coach ON public.schedules;
CREATE POLICY schedules_insert_self_or_coach
ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND cr.coach_id = auth.uid()
      AND cr.student_id = schedules.user_id
  )
);

DROP POLICY IF EXISTS schedules_update_self_or_coach ON public.schedules;
CREATE POLICY schedules_update_self_or_coach
ON public.schedules
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND cr.coach_id = auth.uid()
      AND cr.student_id = schedules.user_id
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND cr.coach_id = auth.uid()
      AND cr.student_id = schedules.user_id
  )
);

DROP POLICY IF EXISTS schedules_delete_self_or_coach ON public.schedules;
CREATE POLICY schedules_delete_self_or_coach
ON public.schedules
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND cr.coach_id = auth.uid()
      AND cr.student_id = schedules.user_id
  )
);
