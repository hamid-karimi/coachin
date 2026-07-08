-- Coach-generated training plans (ranked improvements phase 5).
--
-- Coaches can run the AI plan wizards on behalf of a trainee. The plan is
-- applied directly to the trainee (owner decision: no acceptance step) and
-- `created_by` records who generated it so the UI can label coach plans.

ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Replace the 9-param function with a 10-param version. The old signature is
-- dropped explicitly: keeping both would make PostgREST RPC resolution
-- ambiguous when the new argument is omitted.
DROP FUNCTION IF EXISTS public.create_training_plan(date, text, int, text, jsonb, jsonb, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.create_training_plan(
  p_race_date date,
  p_goal_time text,
  p_weeks_total int,
  p_summary text,
  p_intake jsonb,
  p_raw jsonb,
  p_model text,
  p_items jsonb,
  p_plan_kind text,
  p_target_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id uuid;
  v_user_id uuid;
  v_plan_id uuid;
  v_item jsonb;
  v_count int := 0;
BEGIN
  v_creator_id := auth.uid();
  IF v_creator_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Generating for someone else requires an active coaching relationship.
  v_user_id := COALESCE(p_target_user_id, v_creator_id);
  IF v_user_id <> v_creator_id THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.coaching_relationships cr
      WHERE cr.status = 'active'
        AND cr.coach_id = v_creator_id
        AND cr.student_id = v_user_id
    ) THEN
      RETURN jsonb_build_object('error', 'You do not coach this trainee');
    END IF;
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
    (user_id, created_by, race_date, goal_time, weeks_total, summary, intake, raw_ai_response, model, plan_kind)
  VALUES
    (v_user_id, v_creator_id, p_race_date, NULLIF(TRIM(p_goal_time), ''), p_weeks_total,
     p_summary, COALESCE(p_intake, '{}'::jsonb), p_raw, p_model, p_plan_kind)
  RETURNING id INTO v_plan_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.plan_items (plan_id, week, day_of_week, item_type, title, details, description)
    VALUES (
      v_plan_id,
      LEAST(GREATEST((v_item->>'week')::int, 1), p_weeks_total),
      (v_item->>'day_of_week')::smallint,
      v_item->>'item_type',
      LEFT(v_item->>'title', 200),
      COALESCE(v_item->'details', '{}'::jsonb),
      NULLIF(TRIM(LEFT(v_item->>'description', 2000)), '')
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

GRANT EXECUTE ON FUNCTION public.create_training_plan(date, text, int, text, jsonb, jsonb, text, jsonb, text, uuid) TO authenticated;
