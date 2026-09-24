-- Weekly check-ins (adaptive plan Phase 3): one scorecard + decision row per
-- reviewed plan week, plus an atomic RPC that records the check-in, rewrites
-- ONLY the target week's plan items, and awards +20 XP idempotently.

CREATE TABLE IF NOT EXISTS public.weekly_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL,
  week int NOT NULL CHECK (week >= 1),
  scorecard jsonb NOT NULL,
  decision text NOT NULL CHECK (decision IN ('advance', 'repeat', 'deload')),
  summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT weekly_checkins_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_checkins_plan_id_fkey FOREIGN KEY (plan_id)
    REFERENCES public.training_plans(id) ON DELETE CASCADE,
  CONSTRAINT weekly_checkins_plan_week_unique UNIQUE (plan_id, week)
);

CREATE INDEX IF NOT EXISTS weekly_checkins_plan_idx
  ON public.weekly_checkins (plan_id, week);

-- RLS: owner-only through plan ownership (same EXISTS join as plan_items)
ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_checkins_all_via_plan ON public.weekly_checkins;
CREATE POLICY weekly_checkins_all_via_plan
ON public.weekly_checkins
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.training_plans p
  WHERE p.id = weekly_checkins.plan_id AND p.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.training_plans p
  WHERE p.id = weekly_checkins.plan_id AND p.user_id = auth.uid()
));

-- Coach read on trainees' plans/items so the coaching hub can compute a
-- plan-adherence chip (SELECT-only; EXISTS clause copied from
-- 20260704120000_logs_policies_coach_read.sql). Writes stay owner-only via
-- the existing FOR ALL policies.
DROP POLICY IF EXISTS training_plans_select_coach ON public.training_plans;
CREATE POLICY training_plans_select_coach
ON public.training_plans
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.coaching_relationships cr
  WHERE cr.status = 'active'
    AND cr.coach_id = auth.uid()
    AND cr.student_id = training_plans.user_id
));

DROP POLICY IF EXISTS plan_items_select_coach ON public.plan_items;
CREATE POLICY plan_items_select_coach
ON public.plan_items
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.training_plans p
  JOIN public.coaching_relationships cr
    ON cr.student_id = p.user_id
  WHERE p.id = plan_items.plan_id
    AND cr.status = 'active'
    AND cr.coach_id = auth.uid()
));

-- Atomic check-in apply: record the check-in for the reviewed week, then
-- delete + re-insert ONLY the target week's items (item validation copied
-- from create_training_plan in 20260705100000_training_plans.sql), then
-- award +20 XP idempotently (reason pattern from award_session_log_xp).
-- Never touches any other week's rows.
CREATE OR REPLACE FUNCTION public.apply_week_adjustment(
  p_plan_id uuid,
  p_checkin_week int,
  p_scorecard jsonb,
  p_decision text,
  p_summary text,
  p_target_week int,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan record;
  v_item jsonb;
  v_count int := 0;
  v_checkin_id uuid;
  v_xp_reason text;
  v_awarded_xp int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_plan
  FROM public.training_plans
  WHERE id = p_plan_id AND user_id = v_user_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Active plan not found');
  END IF;

  IF p_decision NOT IN ('advance', 'repeat', 'deload') THEN
    RETURN jsonb_build_object('error', 'Invalid decision');
  END IF;
  IF p_checkin_week IS NULL
     OR p_checkin_week < 1 OR p_checkin_week > v_plan.weeks_total THEN
    RETURN jsonb_build_object('error', 'Check-in week out of range');
  END IF;
  IF p_target_week IS NULL
     OR p_target_week < 1 OR p_target_week > v_plan.weeks_total THEN
    RETURN jsonb_build_object('error', 'Target week out of range');
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'Adjustment has no items');
  END IF;
  IF jsonb_array_length(p_items) > 60 THEN
    RETURN jsonb_build_object('error', 'Adjustment has too many items');
  END IF;

  -- Record the check-in for the reviewed week; the unique (plan_id, week)
  -- constraint refuses a second check-in for the same week.
  INSERT INTO public.weekly_checkins (plan_id, week, scorecard, decision, summary)
  VALUES (p_plan_id, p_checkin_week, COALESCE(p_scorecard, '{}'::jsonb),
          p_decision, NULLIF(TRIM(p_summary), ''))
  RETURNING id INTO v_checkin_id;

  -- Week-scoped rewrite: DELETE carries BOTH plan_id AND week predicates so
  -- no other week's rows can ever be touched.
  DELETE FROM public.plan_items
  WHERE plan_id = p_plan_id AND week = p_target_week;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.plan_items (plan_id, week, day_of_week, item_type, title, details)
    VALUES (
      p_plan_id,
      p_target_week, -- forced: payload week values are ignored
      (v_item->>'day_of_week')::smallint,
      v_item->>'item_type',
      LEFT(v_item->>'title', 200),
      COALESCE(v_item->'details', '{}'::jsonb)
    );
    v_count := v_count + 1;
  END LOOP;

  -- +20 XP once per (plan, reviewed week) — idempotent by unique reason.
  v_xp_reason := 'weekly_checkin:' || p_plan_id || ':' || p_checkin_week;
  IF NOT EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = v_xp_reason
  ) THEN
    INSERT INTO public.xp_transactions (user_id, amount, reason)
    VALUES (v_user_id, 20, v_xp_reason);

    UPDATE public.profiles
    SET xp = COALESCE(xp, 0) + 20,
        level = FLOOR((COALESCE(xp, 0) + 20) / 1000.0) + 1
    WHERE id = v_user_id;

    v_awarded_xp := 20;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'checkin_id', v_checkin_id,
    'replaced_items', v_count,
    'awarded_xp', v_awarded_xp
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'This week was already checked in');
  WHEN OTHERS THEN
    RAISE WARNING 'Week adjustment failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to apply the check-in');
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_week_adjustment(uuid, int, jsonb, text, text, int, jsonb) TO authenticated;
