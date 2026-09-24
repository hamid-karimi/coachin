-- Multi-goal training (roadmap P2): allow multiple concurrent active plans,
-- at most one active per discipline (`race` running vs `hypertrophy` strength).
-- Discipline previously lived only in `intake->>'plan_kind'`; promote it to a
-- real column so the uniqueness constraint and the RPC can key off it.

-- 1. Discipline column.
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS plan_kind text NOT NULL DEFAULT 'race'
    CHECK (plan_kind IN ('race', 'hypertrophy'));

-- 2. Backfill from the intake snapshot (defaults to 'race' when absent).
UPDATE public.training_plans
SET plan_kind = COALESCE(intake->>'plan_kind', 'race');

-- 3. One ACTIVE plan per user PER DISCIPLINE (was: one active per user).
DROP INDEX IF EXISTS public.training_plans_one_active;
CREATE UNIQUE INDEX IF NOT EXISTS training_plans_one_active_per_kind
  ON public.training_plans (user_id, plan_kind)
  WHERE status = 'active';

-- 4. Atomic persist, now discipline-scoped. Signature changes (adds
-- p_plan_kind), so drop the old overload to avoid ambiguity, then recreate.
DROP FUNCTION IF EXISTS public.create_training_plan(date, text, int, text, jsonb, jsonb, text, jsonb);

CREATE OR REPLACE FUNCTION public.create_training_plan(
  p_race_date date,
  p_goal_time text,
  p_weeks_total int,
  p_summary text,
  p_intake jsonb,
  p_raw jsonb,
  p_model text,
  p_items jsonb,
  p_plan_kind text
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

  IF p_plan_kind IS NULL OR p_plan_kind NOT IN ('race', 'hypertrophy') THEN
    RETURN jsonb_build_object('error', 'Invalid plan kind');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Plan has no items');
  END IF;
  IF jsonb_array_length(p_items) > 400 THEN
    RETURN jsonb_build_object('error', 'Plan has too many items');
  END IF;

  -- Replace only the same-discipline active plan; leave the other discipline's
  -- active plan untouched.
  UPDATE public.training_plans
  SET status = 'archived'
  WHERE user_id = v_user_id AND status = 'active' AND plan_kind = p_plan_kind;

  INSERT INTO public.training_plans
    (user_id, race_date, goal_time, weeks_total, summary, intake, raw_ai_response, model, plan_kind)
  VALUES
    (v_user_id, p_race_date, NULLIF(TRIM(p_goal_time), ''), p_weeks_total,
     p_summary, COALESCE(p_intake, '{}'::jsonb), p_raw, p_model, p_plan_kind)
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

GRANT EXECUTE ON FUNCTION public.create_training_plan(date, text, int, text, jsonb, jsonb, text, jsonb, text) TO authenticated;
