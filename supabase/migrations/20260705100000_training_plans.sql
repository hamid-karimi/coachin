-- AI marathon training plans (roadmap branch 4).
-- training_plans holds the intake snapshot + raw AI response; plan_items is
-- the week-by-week schedule (runs, strength, stretch, recovery, meal notes).

CREATE TABLE IF NOT EXISTS public.training_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  race_date date NOT NULL,
  goal_time text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'archived')),
  weeks_total int NOT NULL CHECK (weeks_total BETWEEN 4 AND 24),
  summary text,
  intake jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_ai_response jsonb,
  model text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT training_plans_pkey PRIMARY KEY (id),
  CONSTRAINT training_plans_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS training_plans_user_status_idx
  ON public.training_plans (user_id, status);

-- One ACTIVE plan per user
CREATE UNIQUE INDEX IF NOT EXISTS training_plans_one_active
  ON public.training_plans (user_id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.plan_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  week int NOT NULL CHECK (week >= 1),
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  item_type text NOT NULL CHECK (item_type IN (
    'run', 'strength', 'stretch', 'recovery', 'meal_note'
  )),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_completed boolean NOT NULL DEFAULT false,
  CONSTRAINT plan_items_pkey PRIMARY KEY (id),
  CONSTRAINT plan_items_plan_id_fkey FOREIGN KEY (plan_id)
    REFERENCES public.training_plans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS plan_items_plan_week_idx
  ON public.plan_items (plan_id, week, day_of_week);

-- RLS: plans self-only; items through plan ownership
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_plans_all_self ON public.training_plans;
CREATE POLICY training_plans_all_self
ON public.training_plans
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS plan_items_all_via_plan ON public.plan_items;
CREATE POLICY plan_items_all_via_plan
ON public.plan_items
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.training_plans p
  WHERE p.id = plan_items.plan_id AND p.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.training_plans p
  WHERE p.id = plan_items.plan_id AND p.user_id = auth.uid()
));

-- Atomic persist: archives any current active plan, inserts the new plan and
-- all items in one transaction (style copied from add_atomic_operations).
CREATE OR REPLACE FUNCTION public.create_training_plan(
  p_race_date date,
  p_goal_time text,
  p_weeks_total int,
  p_summary text,
  p_intake jsonb,
  p_raw jsonb,
  p_model text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan_id uuid;
  v_item jsonb;
  v_count int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Plan has no items');
  END IF;
  IF jsonb_array_length(p_items) > 400 THEN
    RETURN jsonb_build_object('error', 'Plan has too many items');
  END IF;

  UPDATE public.training_plans
  SET status = 'archived'
  WHERE user_id = v_user_id AND status = 'active';

  INSERT INTO public.training_plans
    (user_id, race_date, goal_time, weeks_total, summary, intake, raw_ai_response, model)
  VALUES
    (v_user_id, p_race_date, NULLIF(TRIM(p_goal_time), ''), p_weeks_total,
     p_summary, COALESCE(p_intake, '{}'::jsonb), p_raw, p_model)
  RETURNING id INTO v_plan_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.plan_items (plan_id, week, day_of_week, item_type, title, details)
    VALUES (
      v_plan_id,
      LEAST(GREATEST((v_item->>'week')::int, 1), p_weeks_total),
      (v_item->>'day_of_week')::smallint,
      v_item->>'item_type',
      LEFT(v_item->>'title', 200),
      COALESCE(v_item->'details', '{}'::jsonb)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'plan_id', v_plan_id, 'items', v_count);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Training plan creation failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to save the training plan');
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_training_plan(date, text, int, text, jsonb, jsonb, text, jsonb) TO authenticated;
