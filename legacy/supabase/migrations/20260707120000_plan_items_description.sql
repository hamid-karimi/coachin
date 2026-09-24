-- Short plan-item titles + description (ranked improvements phase 1).
--
-- AI plans used to cram the full exercise list into `title` (e.g. "Upper push:
-- bench press 4x8 + incline DB press 3x10 + lateral raises 3x15"), which
-- overflows every card. Split it: `title` stays the short human-readable
-- session name; the new nullable `description` column holds the full session
-- detail. `details` jsonb is untouched.

-- 1. New column (nullable — old rows and manual items may not have one).
ALTER TABLE public.plan_items
  ADD COLUMN IF NOT EXISTS description text;

-- 2. Recreate create_training_plan so items also persist `description` from
-- the item jsonb (`item->>'description'`, null-safe: empty/missing stays NULL).
-- Same signature as 20260706140000_multi_active_plans.sql — only the
-- plan_items INSERT changes.
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

GRANT EXECUTE ON FUNCTION public.create_training_plan(date, text, int, text, jsonb, jsonb, text, jsonb, text) TO authenticated;

-- 3. Backfill existing overlong / list-style titles: move the old title into
-- `description` and replace `title` with a short item-type label. Guarded by
-- `description IS NULL` so re-running is a no-op (idempotent, no hardcoded
-- ids — same defensive style as 20260706140000_dedup_mobility_sport_types.sql).
-- The CASE covers every value allowed by plan_items_item_type_check
-- (20260705180000_mobility_item_type.sql: run, strength, stretch, mobility,
-- recovery, meal_note) with an explicit fallback should the set ever grow.
UPDATE public.plan_items
SET description = title,
    title = CASE item_type
      WHEN 'run' THEN 'Run'
      WHEN 'strength' THEN 'Strength session'
      WHEN 'stretch' THEN 'Stretch'
      WHEN 'mobility' THEN 'Mobility'
      WHEN 'recovery' THEN 'Recovery'
      WHEN 'meal_note' THEN 'Meal note'
      ELSE 'Session'
    END
WHERE description IS NULL
  AND (char_length(title) > 60 OR title LIKE '% + %');
