-- Logs RLS policies: self access + coach read for active trainees.
--
-- Migrations previously defined NO policies for public.logs even though RLS
-- is enabled (20260212000000_initial_schema.sql). The live DB must have had
-- ad-hoc self policies (the app inserts/reads its own logs), so this
-- migration (a) codifies self access idempotently and (b) adds coach read
-- for active trainees via coaching_relationships, copying the EXISTS clause
-- from 20260214103000_schedules_coach_student_policies.sql.

DROP POLICY IF EXISTS logs_select_self_or_coach ON public.logs;
CREATE POLICY logs_select_self_or_coach
ON public.logs
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND cr.coach_id = auth.uid()
      AND cr.student_id = logs.user_id
  )
);

DROP POLICY IF EXISTS logs_insert_self ON public.logs;
CREATE POLICY logs_insert_self
ON public.logs
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS logs_update_self ON public.logs;
CREATE POLICY logs_update_self
ON public.logs
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS logs_delete_self ON public.logs;
CREATE POLICY logs_delete_self
ON public.logs
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
);
