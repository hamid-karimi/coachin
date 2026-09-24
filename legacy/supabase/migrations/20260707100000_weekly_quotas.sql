-- Weekly quotas: a per-user weekly target per sport (N sessions/week, no fixed
-- day). Fulfilled automatically by completed `logs` rows of that sport within
-- the Mon–Sun week. Informational only in v1 — quotas create NO required days,
-- so they never touch streaks, hearts, or XP (streak SQL reads `schedules`).

CREATE TABLE IF NOT EXISTS public.weekly_quotas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sport_type_id bigint NOT NULL REFERENCES public.sport_types(id),
  sessions_per_week int NOT NULL CHECK (sessions_per_week BETWEEN 1 AND 14),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT weekly_quotas_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_quotas_user_sport_unique UNIQUE (user_id, sport_type_id)
);

-- RLS: users only see and manage their own quotas.
ALTER TABLE public.weekly_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_quotas_select_self ON public.weekly_quotas;
CREATE POLICY weekly_quotas_select_self
ON public.weekly_quotas FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS weekly_quotas_insert_self ON public.weekly_quotas;
CREATE POLICY weekly_quotas_insert_self
ON public.weekly_quotas FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS weekly_quotas_update_self ON public.weekly_quotas;
CREATE POLICY weekly_quotas_update_self
ON public.weekly_quotas FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS weekly_quotas_delete_self ON public.weekly_quotas;
CREATE POLICY weekly_quotas_delete_self
ON public.weekly_quotas FOR DELETE TO authenticated USING (user_id = auth.uid());
