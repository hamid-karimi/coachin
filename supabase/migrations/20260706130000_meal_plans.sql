-- AI meal plans: a per-user weekly menu generated from body metrics + training
-- load. One active plan per user; items hold per-meal macros, an ingredient
-- list, a recipe, and a YouTube search query for a how-to video.

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  intake jsonb,
  kcal_target numeric NOT NULL CHECK (kcal_target >= 0),
  protein_g_target numeric NOT NULL DEFAULT 0 CHECK (protein_g_target >= 0),
  carbs_g_target numeric NOT NULL DEFAULT 0 CHECK (carbs_g_target >= 0),
  fat_g_target numeric NOT NULL DEFAULT 0 CHECK (fat_g_target >= 0),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meal_plans_pkey PRIMARY KEY (id)
);

-- At most one active plan per user.
CREATE UNIQUE INDEX IF NOT EXISTS meal_plans_one_active
  ON public.meal_plans (user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.meal_plan_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.meal_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  meal_type text NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  title text NOT NULL,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  recipe text,
  video_query text,
  kcal numeric NOT NULL DEFAULT 0 CHECK (kcal >= 0),
  protein_g numeric NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g numeric NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g numeric NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  sugar_g numeric NOT NULL DEFAULT 0 CHECK (sugar_g >= 0),
  fiber_g numeric NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  sodium_mg numeric NOT NULL DEFAULT 0 CHECK (sodium_mg >= 0),
  sort int NOT NULL DEFAULT 0,
  CONSTRAINT meal_plan_items_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS meal_plan_items_plan_idx
  ON public.meal_plan_items (plan_id, day_of_week, sort);

-- RLS: users only see and manage their own plans + items.
ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meal_plans_select_self ON public.meal_plans;
CREATE POLICY meal_plans_select_self
ON public.meal_plans FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS meal_plans_insert_self ON public.meal_plans;
CREATE POLICY meal_plans_insert_self
ON public.meal_plans FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS meal_plans_update_self ON public.meal_plans;
CREATE POLICY meal_plans_update_self
ON public.meal_plans FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS meal_plans_delete_self ON public.meal_plans;
CREATE POLICY meal_plans_delete_self
ON public.meal_plans FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS meal_plan_items_select_self ON public.meal_plan_items;
CREATE POLICY meal_plan_items_select_self
ON public.meal_plan_items FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS meal_plan_items_insert_self ON public.meal_plan_items;
CREATE POLICY meal_plan_items_insert_self
ON public.meal_plan_items FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS meal_plan_items_delete_self ON public.meal_plan_items;
CREATE POLICY meal_plan_items_delete_self
ON public.meal_plan_items FOR DELETE TO authenticated
USING (user_id = auth.uid());
