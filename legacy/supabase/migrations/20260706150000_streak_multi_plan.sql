-- Multi-plan streak fix.
--
-- After 20260706140000_multi_active_plans.sql a user can hold more than one
-- active training_plan (at most one per discipline). The original
-- evaluate_user_streak (20260706110000_streak_and_league.sql) read the active
-- plan with `... WHERE status='active' LIMIT 1` and checked plan_items for that
-- ONE plan, so a second active plan was silently ignored when deciding whether
-- a day was "required".
--
-- The streak stays DAY-BASED and GLOBAL (see FORMULAS.md §2): a day is
-- "required" if a routine schedule OR ANY active plan schedules a non-meal item
-- that weekday/plan-week, and "trained" if ANY completed log exists that date.
-- Partial completion across disciplines (e.g. runs done, lifts skipped) still
-- counts the day as trained and keeps the streak. Only a fully-missed required
-- day spends a heart. The heart economy is unchanged.
--
-- Only the plan-required check changes below: the single-plan LIMIT 1 lookup is
-- gone; the plan branch is now an EXISTS unioning ALL active plans, each with
-- its own plan-week computed from its own created_at.
CREATE OR REPLACE FUNCTION public.evaluate_user_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile record;
  v_day date;
  v_dow int;
  v_trained boolean;
  v_required boolean;
  v_streak int;
  v_best int;
  v_hearts int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT current_streak, best_streak, hearts, streak_evaluated_date
    INTO v_profile
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  v_streak := COALESCE(v_profile.current_streak, 0);
  v_best   := COALESCE(v_profile.best_streak, 0);
  v_hearts := LEAST(GREATEST(COALESCE(v_profile.hearts, 3), 0), 3);

  -- First run settles only yesterday — no retroactive punishment for days
  -- before the mechanic existed.
  v_day := COALESCE(v_profile.streak_evaluated_date + 1, CURRENT_DATE - 1);

  WHILE v_day < CURRENT_DATE LOOP
    v_dow := EXTRACT(DOW FROM v_day)::int; -- 0=Sun..6=Sat, matches the app

    v_trained := EXISTS (
      SELECT 1 FROM public.logs
      WHERE user_id = v_user_id AND date = v_day AND status = 'completed'
    );

    IF v_trained THEN
      v_streak := v_streak + 1;
      v_best := GREATEST(v_best, v_streak);
      v_hearts := LEAST(v_hearts + 1, 3);
    ELSE
      -- A "training day" = a routine scheduled that weekday...
      v_required := EXISTS (
        SELECT 1 FROM public.schedules s
        WHERE s.user_id = v_user_id
          AND s.day_of_week = v_dow
          AND (s.starts_on IS NULL OR s.starts_on <= v_day)
          AND (s.ends_on IS NULL OR s.ends_on >= v_day)
      );

      -- ...or a non-meal item scheduled that date by ANY active plan. Each
      -- plan's plan-week is derived from its OWN created_at, so plans that
      -- started on different dates line up correctly.
      IF NOT v_required THEN
        v_required := EXISTS (
          SELECT 1
          FROM public.plan_items pi
          JOIN public.training_plans tp ON tp.id = pi.plan_id
          WHERE tp.user_id = v_user_id
            AND tp.status = 'active'
            AND pi.day_of_week = v_dow
            AND pi.item_type <> 'meal_note'
            AND ((date_trunc('week', v_day)::date - date_trunc('week', tp.created_at::date)::date) / 7) + 1
                BETWEEN 1 AND tp.weeks_total
            AND pi.week = ((date_trunc('week', v_day)::date - date_trunc('week', tp.created_at::date)::date) / 7) + 1
        );
      END IF;

      IF v_required THEN
        IF v_hearts > 0 THEN
          v_hearts := v_hearts - 1; -- missed: spend a heart, streak frozen
        ELSE
          v_streak := 0;            -- out of hearts: reset
          v_hearts := 3;
        END IF;
      END IF;
      -- rest day (not required): streak safe, nothing changes
    END IF;

    v_day := v_day + 1;
  END LOOP;

  UPDATE public.profiles
  SET current_streak = v_streak,
      best_streak = v_best,
      hearts = v_hearts,
      streak_evaluated_date = CURRENT_DATE - 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'current_streak', v_streak,
    'best_streak', v_best,
    'hearts', v_hearts
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'User streak evaluation failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to evaluate streak');
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_user_streak() TO authenticated;
