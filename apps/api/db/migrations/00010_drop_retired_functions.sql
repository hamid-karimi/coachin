-- +goose Up
-- Phase 4.3 (ADR-5 Step B): the Go use cases own these awards and settles now
-- (4.2a–d), so the SQL copies go. Cross-user functions stay (ADR-5 amendment):
-- coach / club / group joins and creation, schedule assign, group-day evaluation,
-- group_trained_today, get_weekly_leaderboard, create_training_plan.
DROP FUNCTION public.complete_plan_item(uuid, boolean, date);
DROP FUNCTION public.award_session_log_xp(uuid);
DROP FUNCTION public.award_meal_xp(uuid);
DROP FUNCTION public.award_day_adherence(date);
DROP FUNCTION public.achieve_goal(uuid);
DROP FUNCTION public.evaluate_user_streak();
DROP FUNCTION public.apply_week_adjustment(uuid, integer, jsonb, text, text, integer, jsonb);

-- +goose Down
-- +goose StatementBegin
CREATE FUNCTION public.complete_plan_item(p_item_id uuid, p_completed boolean, p_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DECLARE
    v_user_id uuid;
    v_item record;
    v_xp int;
    v_awards int;
    v_undos int;
  BEGIN
    v_user_id := app.current_user_id();
    IF v_user_id IS NULL THEN
      RETURN jsonb_build_object('error', 'Not authenticated');
    END IF;

    SELECT i.id, i.item_type, i.title, i.is_completed
    INTO v_item
    FROM public.plan_items i
    JOIN public.training_plans p ON p.id = i.plan_id
    WHERE i.id = p_item_id AND p.user_id = v_user_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Plan item not found');
    END IF;

    IF v_item.item_type = 'meal_note' THEN
      RETURN jsonb_build_object('error', 'Meal notes cannot be completed');
    END IF;

    UPDATE public.plan_items
    SET is_completed = p_completed
    WHERE id = p_item_id;

    -- Sessions weigh like a routine workout (60 XP); lighter items less.
    v_xp := CASE v_item.item_type
      WHEN 'run' THEN 60
      WHEN 'strength' THEN 60
      WHEN 'stretch' THEN 30
      WHEN 'mobility' THEN 30
      ELSE 20 -- recovery
    END;

    SELECT count(*) INTO v_awards FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'plan_item:' || p_item_id;
    SELECT count(*) INTO v_undos FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'plan_item_undo:' || p_item_id;

    IF p_completed THEN
      IF v_awards <= v_undos THEN
        INSERT INTO public.xp_transactions (user_id, amount, reason)
        VALUES (v_user_id, v_xp, 'plan_item:' || p_item_id);

        UPDATE public.profiles
        SET xp = COALESCE(xp, 0) + v_xp,
            level = FLOOR((COALESCE(xp, 0) + v_xp) / 1000.0) + 1
        WHERE id = v_user_id;
      ELSE
        v_xp := 0; -- already netted an award for this item
      END IF;

      INSERT INTO public.logs (user_id, date, sport_type_id, status, notes, plan_item_id)
      VALUES (v_user_id, p_date, NULL, 'completed', v_item.title, p_item_id)
      ON CONFLICT (plan_item_id) WHERE plan_item_id IS NOT NULL DO NOTHING;

      RETURN jsonb_build_object('success', true, 'awarded_xp', v_xp);
    ELSE
      DELETE FROM public.logs
      WHERE user_id = v_user_id AND plan_item_id = p_item_id;

      IF v_awards > v_undos THEN
        INSERT INTO public.xp_transactions (user_id, amount, reason)
        VALUES (v_user_id, -v_xp, 'plan_item_undo:' || p_item_id);

        UPDATE public.profiles
        SET xp = GREATEST(COALESCE(xp, 0) - v_xp, 0),
            level = FLOOR(GREATEST(COALESCE(xp, 0) - v_xp, 0) / 1000.0) + 1
        WHERE id = v_user_id;

        RETURN jsonb_build_object('success', true, 'awarded_xp', -v_xp);
      END IF;

      RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Plan item completion failed: %', SQLERRM;
      RETURN jsonb_build_object('error', 'Failed to update the item');
  END;
  $$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION public.award_session_log_xp(p_session_log_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_log record;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_log
  FROM public.session_logs
  WHERE id = p_session_log_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Session log not found');
  END IF;

  -- Idempotent per session log
  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'session_log:' || p_session_log_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 10, 'session_log:' || p_session_log_id);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 10,
      level = FLOOR((COALESCE(xp, 0) + 10) / 1000.0) + 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'awarded_xp', 10);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Session log XP award failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to award XP');
END;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION public.award_meal_xp(p_meal_log_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_log record;
  v_today_awards int;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_log
  FROM public.meal_logs
  WHERE id = p_meal_log_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Meal log not found');
  END IF;

  -- Idempotent per meal log
  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'meal_log:' || p_meal_log_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0, 'capped', false);
  END IF;

  -- Daily cap: 3 meal awards per log date
  SELECT COUNT(*) INTO v_today_awards
  FROM public.xp_transactions x
  JOIN public.meal_logs m ON x.reason = 'meal_log:' || m.id
  WHERE x.user_id = v_user_id AND m.date = v_log.date;

  IF v_today_awards >= 3 THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0, 'capped', true);
  END IF;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 5, 'meal_log:' || p_meal_log_id);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 5,
      level = FLOOR((COALESCE(xp, 0) + 5) / 1000.0) + 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'awarded_xp', 5, 'capped', false);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Meal XP award failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to award XP');
END;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION public.award_day_adherence(p_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_target numeric;
  v_total numeric;
  v_meals int;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_date >= CURRENT_DATE THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  -- Once per day
  IF EXISTS (
    SELECT 1 FROM public.xp_transactions
    WHERE user_id = v_user_id AND reason = 'calorie_goal:' || p_date
  ) THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  SELECT target_value INTO v_target
  FROM public.goals
  WHERE user_id = v_user_id AND goal_type = 'calorie_intake'
    AND status = 'active'
  LIMIT 1;
  IF v_target IS NULL THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  SELECT COALESCE(SUM(kcal), 0), COUNT(*) INTO v_total, v_meals
  FROM public.meal_logs
  WHERE user_id = v_user_id AND date = p_date;

  IF v_meals < 2 OR v_total < v_target * 0.9 OR v_total > v_target * 1.1 THEN
    RETURN jsonb_build_object('success', true, 'awarded_xp', 0);
  END IF;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 30, 'calorie_goal:' || p_date);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 30,
      level = FLOOR((COALESCE(xp, 0) + 30) / 1000.0) + 1
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'awarded_xp', 30);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Adherence award failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to award adherence bonus');
END;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION public.achieve_goal(p_goal_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_goal record;
  v_new_xp int;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_goal
  FROM public.goals
  WHERE id = p_goal_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Goal not found');
  END IF;

  IF v_goal.status <> 'active' THEN
    -- Already settled — idempotent no-op.
    RETURN jsonb_build_object('success', true, 'status', 'already_settled');
  END IF;

  UPDATE public.goals
  SET status = 'achieved', achieved_at = now()
  WHERE id = p_goal_id;

  INSERT INTO public.xp_transactions (user_id, amount, reason)
  VALUES (v_user_id, 200, 'goal_achieved:' || p_goal_id);

  UPDATE public.profiles
  SET xp = COALESCE(xp, 0) + 200,
      level = FLOOR((COALESCE(xp, 0) + 200) / 1000.0) + 1
  WHERE id = v_user_id
  RETURNING xp INTO v_new_xp;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'achieved',
    'awarded_xp', 200,
    'new_xp', v_new_xp
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Goal achievement failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to record goal achievement');
END;
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION public.evaluate_user_streak() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  v_user_id := app.current_user_id();
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
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION public.apply_week_adjustment(p_plan_id uuid, p_checkin_week integer, p_scorecard jsonb, p_decision text, p_summary text, p_target_week integer, p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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
  v_user_id := app.current_user_id();
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
-- +goose StatementEnd
