-- Daily supplements checklist (vitamins, creatine, whey, amino …).
--
-- A supplement is a user-defined daily habit; a supplement_logs row marks it
-- taken on a date (one per supplement per day). Informational only: taking
-- supplements never awards XP and never touches streaks or hearts — the
-- dashboard card is a reminder + logger, not a gameplay surface.

CREATE TABLE IF NOT EXISTS public.supplements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  dose text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT supplements_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.supplement_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  supplement_id uuid NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT supplement_logs_pkey PRIMARY KEY (id),
  CONSTRAINT supplement_logs_unique_per_day UNIQUE (supplement_id, date)
);

CREATE INDEX IF NOT EXISTS supplement_logs_user_date_idx
  ON public.supplement_logs (user_id, date);

ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;

-- Self-only, every operation (same pattern as meal_logs pre-sharing).
DROP POLICY IF EXISTS supplements_select_self ON public.supplements;
CREATE POLICY supplements_select_self
ON public.supplements FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS supplements_insert_self ON public.supplements;
CREATE POLICY supplements_insert_self
ON public.supplements FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS supplements_delete_self ON public.supplements;
CREATE POLICY supplements_delete_self
ON public.supplements FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS supplement_logs_select_self ON public.supplement_logs;
CREATE POLICY supplement_logs_select_self
ON public.supplement_logs FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS supplement_logs_insert_self ON public.supplement_logs;
CREATE POLICY supplement_logs_insert_self
ON public.supplement_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS supplement_logs_delete_self ON public.supplement_logs;
CREATE POLICY supplement_logs_delete_self
ON public.supplement_logs FOR DELETE TO authenticated USING (user_id = auth.uid());
