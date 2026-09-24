-- Body metrics for training/diet personalization (roadmap branch 1).
-- profiles carries the LATEST snapshot; body_measurements is the time series.

-- 1) Profile snapshot columns (all nullable — progressive profiling)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS sex text
    CHECK (sex IN ('male', 'female', 'other')),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,1)
    CHECK (height_cm IS NULL OR (height_cm >= 100 AND height_cm <= 250)),
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2)
    CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 300)),
  ADD COLUMN IF NOT EXISTS body_fat_pct numeric(4,1)
    CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 3 AND body_fat_pct <= 60)),
  ADD COLUMN IF NOT EXISTS training_history text,
  ADD COLUMN IF NOT EXISTS preferred_units text NOT NULL DEFAULT 'metric'
    CHECK (preferred_units IN ('metric', 'imperial'));

-- 2) Measurement time series
CREATE TABLE IF NOT EXISTS public.body_measurements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  measured_at date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric(5,2)
    CHECK (weight_kg IS NULL OR (weight_kg >= 30 AND weight_kg <= 300)),
  body_fat_pct numeric(4,1)
    CHECK (body_fat_pct IS NULL OR (body_fat_pct >= 3 AND body_fat_pct <= 60)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT body_measurements_pkey PRIMARY KEY (id),
  CONSTRAINT body_measurements_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT body_measurements_has_value
    CHECK (weight_kg IS NOT NULL OR body_fat_pct IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS body_measurements_user_date_idx
  ON public.body_measurements (user_id, measured_at DESC);

-- 3) RLS: self-only (policy style copied from xp_transactions_select_self)
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS body_measurements_select_self ON public.body_measurements;
CREATE POLICY body_measurements_select_self
ON public.body_measurements
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS body_measurements_insert_self ON public.body_measurements;
CREATE POLICY body_measurements_insert_self
ON public.body_measurements
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS body_measurements_delete_self ON public.body_measurements;
CREATE POLICY body_measurements_delete_self
ON public.body_measurements
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
