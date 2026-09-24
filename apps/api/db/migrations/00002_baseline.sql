-- Baseline: the schema of the legacy Supabase app (all 40 migrations in
-- legacy/supabase/migrations), cleaned of every Supabase artifact:
--   * auth.users           -> public.users (our own; UUIDs are kept on import)
--   * auth.uid()           -> app.current_user_id()   (see 00001)
--   * TO authenticated     -> TO coachin_app
--   * storage.* policies   -> dropped (the API enforces photo access)
-- Generated once by replaying the legacy migrations into Postgres 18 (with a
-- scratch auth/storage shim), `pg_dump --schema-only --schema=public`, and a
-- mechanical rewrite. From here on, edit the schema with new migrations.
--
-- SECURITY DEFINER functions are kept for now (plan Phase 3 "Step A": the API
-- calls them); Phase 4 moves their logic into Go and drops them.

-- +goose Up
-- +goose StatementBegin
-- pg_dump orders functions before the tables their SQL bodies reference;
-- skip body validation for this transaction only.
SET LOCAL check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS citext;

-- Accounts. Owned by the API's auth module (Phase 2); profiles.id references it.
CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    email public.citext NOT NULL UNIQUE,
    -- argon2id for new passwords; bcrypt for accounts imported from Supabase
    -- until their next login rehashes them.
    password_hash text NOT NULL,
    email_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users FOR SELECT TO coachin_app
    USING (id = app.current_user_id());

CREATE TYPE public.log_status AS ENUM (
    'completed',
    'skipped',
    'missed'
);

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

CREATE FUNCTION public.assign_coach_schedule_to_student(p_student_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_coach_id uuid;
  v_schedule_count int;
BEGIN
  v_coach_id := app.current_user_id();
  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF NOT EXISTS(
    SELECT 1
    FROM public.coaching_relationships
    WHERE coach_id = v_coach_id
      AND student_id = p_student_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('error', 'No active coaching relationship found');
  END IF;

  SELECT COUNT(*)
  INTO v_schedule_count
  FROM public.schedules
  WHERE user_id = v_coach_id;

  IF v_schedule_count = 0 THEN
    RETURN jsonb_build_object('error', 'Coach has no schedule to assign');
  END IF;

  DELETE FROM public.schedules
  WHERE user_id = p_student_id;

  INSERT INTO public.schedules (user_id, day_of_week, sport_type_id, time)
  SELECT p_student_id, day_of_week, sport_type_id, time
  FROM public.schedules
  WHERE user_id = v_coach_id;

  RETURN jsonb_build_object(
    'success', true,
    'schedules_assigned', v_schedule_count
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Schedule assignment failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to replace schedule');
END;
$$;

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

CREATE FUNCTION public.create_club_with_owner(p_club_name text, p_club_description text, p_invite_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_club_id uuid;
  v_has_primary boolean;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF LENGTH(TRIM(p_club_name)) < 3 THEN
    RETURN jsonb_build_object('error', 'Club name must be at least 3 characters');
  END IF;

  INSERT INTO public.clubs (name, description, owner_id, invite_code)
  VALUES (
    TRIM(p_club_name),
    NULLIF(TRIM(p_club_description), ''),
    v_user_id,
    UPPER(TRIM(p_invite_code))
  )
  RETURNING id INTO v_club_id;

  SELECT EXISTS(
    SELECT 1
    FROM public.club_members
    WHERE user_id = v_user_id AND is_primary = true
  ) INTO v_has_primary;

  INSERT INTO public.club_members (club_id, user_id, role, is_primary)
  VALUES (v_club_id, v_user_id, 'owner', NOT v_has_primary);

  RETURN jsonb_build_object(
    'success', true,
    'club_id', v_club_id,
    'invite_code', UPPER(TRIM(p_invite_code))
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'Invite code already exists');
  WHEN OTHERS THEN
    RAISE WARNING 'Club creation failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to create club');
END;
$$;

CREATE FUNCTION public.create_training_group(p_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_group_id uuid;
  v_code text;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF LENGTH(TRIM(p_name)) < 3 THEN
    RETURN jsonb_build_object('error', 'Group name must be at least 3 characters');
  END IF;

  v_code := 'GRP-' || UPPER(SUBSTRING(MD5(gen_random_uuid()::text) FROM 1 FOR 6));

  INSERT INTO public.training_groups (name, invite_code, created_by)
  VALUES (TRIM(p_name), v_code, v_user_id)
  RETURNING id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group_id, v_user_id);

  RETURN jsonb_build_object('success', true, 'group_id', v_group_id, 'invite_code', v_code);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Group creation failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to create the group');
END;
$$;

CREATE FUNCTION public.create_training_plan(p_race_date date, p_goal_time text, p_weeks_total integer, p_summary text, p_intake jsonb, p_raw jsonb, p_model text, p_items jsonb, p_plan_kind text, p_target_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_creator_id uuid;
  v_user_id uuid;
  v_plan_id uuid;
  v_item jsonb;
  v_count int := 0;
BEGIN
  v_creator_id := app.current_user_id();
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

CREATE FUNCTION public.enforce_body_photo_cap() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_cap int;
  v_count int;
BEGIN
  v_cap := CASE NEW.kind
    WHEN 'body_photo' THEN 5
    WHEN 'progress' THEN 24
    ELSE NULL
  END;
  IF v_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM public.body_photos
    WHERE user_id = NEW.user_id AND kind = NEW.kind;
    IF v_count >= v_cap THEN
      RAISE EXCEPTION '% limit reached (max %)', NEW.kind, v_cap;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.evaluate_group_days(p_group_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_group record;
  v_day date;
  v_member_count int;
  v_trained_count int;
  v_bonus int;
  v_member record;
  v_full_days int := 0;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_group
  FROM public.training_groups
  WHERE id = p_group_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Group not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'Not a member of this group');
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM public.group_members WHERE group_id = p_group_id;

  -- Solo groups don't accrue (accountability needs company).
  IF v_member_count < 2 THEN
    RETURN jsonb_build_object('success', true, 'evaluated', 0, 'note', 'needs_2_members');
  END IF;

  v_day := COALESCE(v_group.last_evaluated_date + 1, CURRENT_DATE - 1);

  WHILE v_day < CURRENT_DATE LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.group_days
      WHERE group_id = p_group_id AND date = v_day
    ) THEN
      SELECT COUNT(DISTINCT l.user_id) INTO v_trained_count
      FROM public.logs l
      JOIN public.group_members gm
        ON gm.group_id = p_group_id AND gm.user_id = l.user_id
      WHERE l.date = v_day AND l.status = 'completed';

      IF v_trained_count = v_member_count THEN
        v_full_days := v_full_days + 1;
        UPDATE public.training_groups
        SET streak_count = streak_count + 1,
            best_streak = GREATEST(best_streak, streak_count + 1)
        WHERE id = p_group_id;

        SELECT streak_count INTO v_group.streak_count
        FROM public.training_groups WHERE id = p_group_id;
        v_bonus := LEAST(10 + v_group.streak_count * 2, 50);

        FOR v_member IN
          SELECT user_id FROM public.group_members WHERE group_id = p_group_id
        LOOP
          INSERT INTO public.xp_transactions (user_id, amount, reason)
          VALUES (v_member.user_id, v_bonus,
                  'group_streak:' || p_group_id || ':' || v_day);
          UPDATE public.profiles
          SET xp = COALESCE(xp, 0) + v_bonus,
              level = FLOOR((COALESCE(xp, 0) + v_bonus) / 1000.0) + 1
          WHERE id = v_member.user_id;
        END LOOP;

        INSERT INTO public.group_days (group_id, date, all_trained)
        VALUES (p_group_id, v_day, true);
      ELSE
        -- Freeze: record the day, streak unchanged, no XP anywhere.
        INSERT INTO public.group_days (group_id, date, all_trained)
        VALUES (p_group_id, v_day, false);
      END IF;
    END IF;

    UPDATE public.training_groups
    SET last_evaluated_date = v_day
    WHERE id = p_group_id;

    v_day := v_day + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'full_days', v_full_days);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Group evaluation failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to evaluate the group');
END;
$$;

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

CREATE FUNCTION public.get_weekly_leaderboard(p_user_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, email text, full_name text, avatar_url text, level integer, league_tier text, weekly_xp bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.level,
    p.league_tier,
    COALESCE(wl.weekly_xp, 0) as weekly_xp
  FROM public.profiles p
  LEFT JOIN public.weekly_leaderboard wl ON p.id = wl.user_id
  WHERE
    (p_user_ids IS NULL OR p.id = ANY(p_user_ids))
  ORDER BY weekly_xp DESC
  LIMIT p_limit;
END;
$$;

CREATE FUNCTION public.group_trained_today(p_group_id uuid) RETURNS uuid[]
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_result uuid[];
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = v_user_id
  ) THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT l.user_id), ARRAY[]::uuid[])
  INTO v_result
  FROM public.logs l
  JOIN public.group_members gm
    ON gm.group_id = p_group_id AND gm.user_id = l.user_id
  WHERE l.date = CURRENT_DATE AND l.status = 'completed';

  RETURN v_result;
END;
$$;

CREATE FUNCTION public.is_club_member(p_club_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = p_user_id
  );
$$;

CREATE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE FUNCTION public.join_club_via_invite_code(p_invite_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_club_id uuid;
  v_user_id uuid;
  v_has_primary boolean;
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate and fetch club by invite code
  SELECT id
  INTO v_club_id
  FROM public.clubs
  WHERE invite_code = UPPER(TRIM(p_invite_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid club invite code');
  END IF;

  -- Check if user already has a primary club
  SELECT EXISTS(
    SELECT 1
    FROM public.club_members
    WHERE user_id = v_user_id AND is_primary = true
  ) INTO v_has_primary;

  -- Insert club membership
  INSERT INTO public.club_members (club_id, user_id, role, is_primary)
  VALUES (v_club_id, v_user_id, 'member', NOT v_has_primary)
  ON CONFLICT (club_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Log error server-side for debugging
    RAISE WARNING 'Error in join_club_via_invite_code: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    -- Return generic user-facing message
    RETURN jsonb_build_object('error', 'An error occurred while processing your request. Please try again.');
END;
$$;

CREATE FUNCTION public.join_coaching_via_invite_code(p_invite_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_existing_status text;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT coach_id, sport_type_id, is_active, expires_at
  INTO v_invite
  FROM public.coach_invite_codes
  WHERE code = UPPER(TRIM(p_invite_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid invite code');
  END IF;

  IF v_invite.coach_id = v_user_id THEN
    RETURN jsonb_build_object('error', 'Cannot add yourself as coach');
  END IF;

  SELECT status
  INTO v_existing_status
  FROM public.coaching_relationships
  WHERE coach_id = v_invite.coach_id
    AND student_id = v_user_id
    AND sport_type_id = v_invite.sport_type_id
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_status = 'active' THEN
      RETURN jsonb_build_object('success', true, 'status', 'already_connected');
    END IF;

    UPDATE public.coaching_relationships
    SET status = 'active'
    WHERE coach_id = v_invite.coach_id
      AND student_id = v_user_id
      AND sport_type_id = v_invite.sport_type_id;

    RETURN jsonb_build_object('success', true, 'status', 'reactivated');
  END IF;

  INSERT INTO public.coaching_relationships (coach_id, student_id, sport_type_id, status)
  VALUES (v_invite.coach_id, v_user_id, v_invite.sport_type_id, 'active');

  RETURN jsonb_build_object('success', true, 'status', 'created');
EXCEPTION
  WHEN OTHERS THEN
    -- Log error server-side for debugging
    RAISE WARNING 'Error in join_coaching_via_invite_code: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    -- Return generic user-facing message
    RETURN jsonb_build_object('error', 'An error occurred while processing your request. Please try again.');
END;
$$;

CREATE FUNCTION public.join_training_group(p_invite_code text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_group record;
  v_members int;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_group
  FROM public.training_groups
  WHERE invite_code = UPPER(TRIM(p_invite_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invite code not found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = v_group.id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_member', 'group_id', v_group.id);
  END IF;

  SELECT COUNT(*) INTO v_members
  FROM public.group_members WHERE group_id = v_group.id;
  IF v_members >= 10 THEN
    RETURN jsonb_build_object('error', 'This group is full (10 members max)');
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (v_group.id, v_user_id);

  RETURN jsonb_build_object('success', true, 'status', 'created', 'group_id', v_group.id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Group join failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to join the group');
END;
$$;

CREATE FUNCTION public.league_tier_for_xp(p_xp bigint) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN COALESCE(p_xp, 0) >= 50000 THEN 'platinum'
    WHEN COALESCE(p_xp, 0) >= 20000 THEN 'gold'
    WHEN COALESCE(p_xp, 0) >=  5000 THEN 'silver'
    ELSE 'bronze'
  END;
$$;

CREATE FUNCTION public.leave_training_group(p_group_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id uuid;
  v_remaining int;
BEGIN
  v_user_id := app.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  DELETE FROM public.group_members
  WHERE group_id = p_group_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'You are not in this group');
  END IF;

  SELECT COUNT(*) INTO v_remaining
  FROM public.group_members WHERE group_id = p_group_id;
  IF v_remaining = 0 THEN
    DELETE FROM public.training_groups WHERE id = p_group_id;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Group leave failed: %', SQLERRM;
    RETURN jsonb_build_object('error', 'Failed to leave the group');
END;
$$;

CREATE FUNCTION public.sync_league_tier() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.league_tier := public.league_tier_for_xp(NEW.xp);
  RETURN NEW;
END;
$$;

CREATE TABLE public.body_measurements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    measured_at date DEFAULT CURRENT_DATE NOT NULL,
    weight_kg numeric(5,2),
    body_fat_pct numeric(4,1),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT body_measurements_body_fat_pct_check CHECK (((body_fat_pct IS NULL) OR ((body_fat_pct >= (3)::numeric) AND (body_fat_pct <= (60)::numeric)))),
    CONSTRAINT body_measurements_has_value CHECK (((weight_kg IS NOT NULL) OR (body_fat_pct IS NOT NULL))),
    CONSTRAINT body_measurements_weight_kg_check CHECK (((weight_kg IS NULL) OR ((weight_kg >= (30)::numeric) AND (weight_kg <= (300)::numeric))))
);

CREATE TABLE public.body_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    storage_path text NOT NULL,
    kind text NOT NULL,
    analysis jsonb,
    analyzed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT body_photos_kind_check CHECK ((kind = ANY (ARRAY['body_photo'::text, 'analysis_report'::text, 'progress'::text])))
);

CREATE TABLE public.club_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    club_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text DEFAULT 'member'::text,
    joined_at timestamp with time zone DEFAULT now(),
    is_primary boolean DEFAULT false NOT NULL
);

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    owner_id uuid NOT NULL,
    invite_code text NOT NULL,
    telegram_link text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.coach_invite_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    sport_type_id bigint NOT NULL,
    code text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.coaching_relationships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    coach_id uuid NOT NULL,
    student_id uuid NOT NULL,
    sport_type_id bigint,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT coaching_relationships_no_self_link CHECK ((coach_id <> student_id))
);

CREATE TABLE public.daily_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    date date NOT NULL,
    content text NOT NULL,
    is_completed boolean DEFAULT false,
    feedback text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.foods (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    brand text,
    kcal_per_100g numeric NOT NULL,
    protein_g numeric DEFAULT 0 NOT NULL,
    carbs_g numeric DEFAULT 0 NOT NULL,
    fat_g numeric DEFAULT 0 NOT NULL,
    source text DEFAULT 'custom'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sugar_g numeric,
    fiber_g numeric,
    sodium_mg numeric,
    CONSTRAINT foods_carbs_g_check CHECK ((carbs_g >= (0)::numeric)),
    CONSTRAINT foods_fat_g_check CHECK ((fat_g >= (0)::numeric)),
    CONSTRAINT foods_fiber_g_check CHECK (((fiber_g IS NULL) OR (fiber_g >= (0)::numeric))),
    CONSTRAINT foods_kcal_per_100g_check CHECK ((kcal_per_100g >= (0)::numeric)),
    CONSTRAINT foods_protein_g_check CHECK ((protein_g >= (0)::numeric)),
    CONSTRAINT foods_sodium_mg_check CHECK (((sodium_mg IS NULL) OR (sodium_mg >= (0)::numeric))),
    CONSTRAINT foods_source_check CHECK ((source = ANY (ARRAY['seed'::text, 'usda'::text, 'custom'::text]))),
    CONSTRAINT foods_sugar_g_check CHECK (((sugar_g IS NULL) OR (sugar_g >= (0)::numeric)))
);

CREATE TABLE public.goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    goal_type text NOT NULL,
    target_value numeric NOT NULL,
    start_value numeric,
    target_date date,
    status text DEFAULT 'active'::text NOT NULL,
    achieved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT goals_goal_type_check CHECK ((goal_type = ANY (ARRAY['weight'::text, 'calorie_intake'::text, 'calories_burned'::text, 'weekly_run_km'::text, 'monthly_run_km'::text, 'body_fat_pct'::text]))),
    CONSTRAINT goals_status_check CHECK ((status = ANY (ARRAY['active'::text, 'achieved'::text, 'abandoned'::text]))),
    CONSTRAINT goals_target_value_check CHECK ((target_value > (0)::numeric))
);

CREATE TABLE public.group_days (
    group_id uuid NOT NULL,
    date date NOT NULL,
    all_trained boolean NOT NULL
);

CREATE TABLE public.group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    date date NOT NULL,
    sport_type_id bigint,
    status public.log_status NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    plan_item_id uuid
);

CREATE TABLE public.meal_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    meal_type text NOT NULL,
    food_id uuid,
    free_text text,
    quantity_g numeric,
    kcal numeric NOT NULL,
    protein_g numeric DEFAULT 0 NOT NULL,
    carbs_g numeric DEFAULT 0 NOT NULL,
    fat_g numeric DEFAULT 0 NOT NULL,
    entry_method text DEFAULT 'search'::text NOT NULL,
    photo_estimate jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sugar_g numeric DEFAULT 0 NOT NULL,
    fiber_g numeric DEFAULT 0 NOT NULL,
    sodium_mg numeric DEFAULT 0 NOT NULL,
    CONSTRAINT meal_logs_carbs_g_check CHECK ((carbs_g >= (0)::numeric)),
    CONSTRAINT meal_logs_entry_method_check CHECK ((entry_method = ANY (ARRAY['search'::text, 'photo'::text, 'manual'::text]))),
    CONSTRAINT meal_logs_fat_g_check CHECK ((fat_g >= (0)::numeric)),
    CONSTRAINT meal_logs_fiber_g_check CHECK ((fiber_g >= (0)::numeric)),
    CONSTRAINT meal_logs_kcal_check CHECK (((kcal >= (0)::numeric) AND (kcal <= (5000)::numeric))),
    CONSTRAINT meal_logs_meal_type_check CHECK ((meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text]))),
    CONSTRAINT meal_logs_protein_g_check CHECK ((protein_g >= (0)::numeric)),
    CONSTRAINT meal_logs_quantity_g_check CHECK (((quantity_g IS NULL) OR (quantity_g > (0)::numeric))),
    CONSTRAINT meal_logs_sodium_mg_check CHECK ((sodium_mg >= (0)::numeric)),
    CONSTRAINT meal_logs_sugar_g_check CHECK ((sugar_g >= (0)::numeric))
);

CREATE TABLE public.meal_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    user_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    meal_type text NOT NULL,
    title text NOT NULL,
    ingredients jsonb DEFAULT '[]'::jsonb NOT NULL,
    recipe text,
    video_query text,
    kcal numeric DEFAULT 0 NOT NULL,
    protein_g numeric DEFAULT 0 NOT NULL,
    carbs_g numeric DEFAULT 0 NOT NULL,
    fat_g numeric DEFAULT 0 NOT NULL,
    sugar_g numeric DEFAULT 0 NOT NULL,
    fiber_g numeric DEFAULT 0 NOT NULL,
    sodium_mg numeric DEFAULT 0 NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    CONSTRAINT meal_plan_items_carbs_g_check CHECK ((carbs_g >= (0)::numeric)),
    CONSTRAINT meal_plan_items_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT meal_plan_items_fat_g_check CHECK ((fat_g >= (0)::numeric)),
    CONSTRAINT meal_plan_items_fiber_g_check CHECK ((fiber_g >= (0)::numeric)),
    CONSTRAINT meal_plan_items_kcal_check CHECK ((kcal >= (0)::numeric)),
    CONSTRAINT meal_plan_items_meal_type_check CHECK ((meal_type = ANY (ARRAY['breakfast'::text, 'lunch'::text, 'dinner'::text, 'snack'::text]))),
    CONSTRAINT meal_plan_items_protein_g_check CHECK ((protein_g >= (0)::numeric)),
    CONSTRAINT meal_plan_items_sodium_mg_check CHECK ((sodium_mg >= (0)::numeric)),
    CONSTRAINT meal_plan_items_sugar_g_check CHECK ((sugar_g >= (0)::numeric))
);

CREATE TABLE public.meal_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    intake jsonb,
    kcal_target numeric NOT NULL,
    protein_g_target numeric DEFAULT 0 NOT NULL,
    carbs_g_target numeric DEFAULT 0 NOT NULL,
    fat_g_target numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT meal_plans_carbs_g_target_check CHECK ((carbs_g_target >= (0)::numeric)),
    CONSTRAINT meal_plans_fat_g_target_check CHECK ((fat_g_target >= (0)::numeric)),
    CONSTRAINT meal_plans_kcal_target_check CHECK ((kcal_target >= (0)::numeric)),
    CONSTRAINT meal_plans_protein_g_target_check CHECK ((protein_g_target >= (0)::numeric)),
    CONSTRAINT meal_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text])))
);

CREATE TABLE public.plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    week integer NOT NULL,
    day_of_week smallint NOT NULL,
    item_type text NOT NULL,
    title text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_completed boolean DEFAULT false NOT NULL,
    description text,
    CONSTRAINT plan_items_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6))),
    CONSTRAINT plan_items_item_type_check CHECK ((item_type = ANY (ARRAY['run'::text, 'strength'::text, 'stretch'::text, 'mobility'::text, 'recovery'::text, 'meal_note'::text]))),
    CONSTRAINT plan_items_week_check CHECK ((week >= 1))
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    role text DEFAULT 'student'::text,
    xp integer DEFAULT 0,
    level integer DEFAULT 1,
    hearts integer DEFAULT 3,
    current_streak integer DEFAULT 0,
    best_streak integer DEFAULT 0,
    league_tier text DEFAULT 'bronze'::text,
    full_name text,
    avatar_url text,
    birth_date date,
    sex text,
    height_cm numeric(5,1),
    weight_kg numeric(5,2),
    body_fat_pct numeric(4,1),
    training_history text,
    preferred_units text DEFAULT 'metric'::text NOT NULL,
    ai_photo_consent_at timestamp with time zone,
    streak_evaluated_date date,
    nutrition_sharing_enabled boolean DEFAULT false NOT NULL,
    country text,
    CONSTRAINT profiles_body_fat_pct_check CHECK (((body_fat_pct IS NULL) OR ((body_fat_pct >= (3)::numeric) AND (body_fat_pct <= (60)::numeric)))),
    CONSTRAINT profiles_height_cm_check CHECK (((height_cm IS NULL) OR ((height_cm >= (100)::numeric) AND (height_cm <= (250)::numeric)))),
    CONSTRAINT profiles_preferred_units_check CHECK ((preferred_units = ANY (ARRAY['metric'::text, 'imperial'::text]))),
    CONSTRAINT profiles_sex_check CHECK ((sex = ANY (ARRAY['male'::text, 'female'::text, 'other'::text]))),
    CONSTRAINT profiles_weight_kg_check CHECK (((weight_kg IS NULL) OR ((weight_kg >= (30)::numeric) AND (weight_kg <= (300)::numeric))))
);

CREATE TABLE public.schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    day_of_week smallint NOT NULL,
    sport_type_id bigint,
    "time" time without time zone,
    created_at timestamp with time zone DEFAULT now(),
    starts_on date,
    ends_on date,
    CONSTRAINT schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

CREATE TABLE public.session_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan_item_id uuid NOT NULL,
    sport text NOT NULL,
    rpe integer,
    actual jsonb DEFAULT '{}'::jsonb NOT NULL,
    note text,
    ai_feedback jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT session_logs_rpe_check CHECK (((rpe IS NULL) OR ((rpe >= 1) AND (rpe <= 10)))),
    CONSTRAINT session_logs_sport_check CHECK ((sport = ANY (ARRAY['run'::text, 'strength'::text])))
);

CREATE TABLE public.social_graph (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    follower_id uuid,
    following_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.sport_types (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text,
    xp_multiplier real
);

ALTER TABLE public.sport_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.sport_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE public.supplement_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    supplement_id uuid NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.supplements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    dose text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    schedule_type text DEFAULT 'daily'::text NOT NULL,
    days_of_week smallint[],
    CONSTRAINT supplements_schedule_type_check CHECK ((schedule_type = ANY (ARRAY['daily'::text, 'training_days'::text, 'custom'::text])))
);

CREATE TABLE public.training_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    invite_code text NOT NULL,
    created_by uuid NOT NULL,
    streak_count integer DEFAULT 0 NOT NULL,
    best_streak integer DEFAULT 0 NOT NULL,
    last_evaluated_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_groups_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 3) AND (length(TRIM(BOTH FROM name)) <= 60)))
);

CREATE TABLE public.training_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    race_date date,
    goal_time text,
    status text DEFAULT 'active'::text NOT NULL,
    weeks_total integer NOT NULL,
    summary text,
    intake jsonb DEFAULT '{}'::jsonb NOT NULL,
    raw_ai_response jsonb,
    model text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    plan_kind text DEFAULT 'race'::text NOT NULL,
    created_by uuid,
    CONSTRAINT training_plans_plan_kind_check CHECK ((plan_kind = ANY (ARRAY['race'::text, 'hypertrophy'::text]))),
    CONSTRAINT training_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text]))),
    CONSTRAINT training_plans_weeks_total_check CHECK (((weeks_total >= 4) AND (weeks_total <= 24)))
);

CREATE TABLE public.weekly_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    week integer NOT NULL,
    scorecard jsonb NOT NULL,
    decision text NOT NULL,
    summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weekly_checkins_decision_check CHECK ((decision = ANY (ARRAY['advance'::text, 'repeat'::text, 'deload'::text]))),
    CONSTRAINT weekly_checkins_week_check CHECK ((week >= 1))
);

CREATE TABLE public.xp_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    amount integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);

CREATE VIEW public.weekly_leaderboard WITH (security_invoker='on') AS
 SELECT user_id,
    sum(amount) AS weekly_xp
   FROM public.xp_transactions
  WHERE (created_at >= (now() - '7 days'::interval))
  GROUP BY user_id;

CREATE TABLE public.weekly_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    sport_type_id bigint NOT NULL,
    sessions_per_week integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weekly_quotas_sessions_per_week_check CHECK (((sessions_per_week >= 1) AND (sessions_per_week <= 14)))
);

ALTER TABLE ONLY public.body_measurements
    ADD CONSTRAINT body_measurements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.body_photos
    ADD CONSTRAINT body_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.body_photos
    ADD CONSTRAINT body_photos_storage_path_unique UNIQUE (storage_path);

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_club_user_key UNIQUE (club_id, user_id);

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_invite_code_key UNIQUE (invite_code);

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.coach_invite_codes
    ADD CONSTRAINT coach_invite_codes_coach_sport_key UNIQUE (coach_id, sport_type_id);

ALTER TABLE ONLY public.coach_invite_codes
    ADD CONSTRAINT coach_invite_codes_code_key UNIQUE (code);

ALTER TABLE ONLY public.coach_invite_codes
    ADD CONSTRAINT coach_invite_codes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_coach_student_sport_key UNIQUE (coach_id, student_id, sport_type_id);

ALTER TABLE ONLY public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.daily_plans
    ADD CONSTRAINT daily_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.group_days
    ADD CONSTRAINT group_days_pkey PRIMARY KEY (group_id, date);

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meal_logs
    ADD CONSTRAINT meal_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meal_plan_items
    ADD CONSTRAINT meal_plan_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plan_items
    ADD CONSTRAINT plan_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT session_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT session_logs_plan_item_unique UNIQUE (plan_item_id);

ALTER TABLE ONLY public.social_graph
    ADD CONSTRAINT social_graph_follower_following_key UNIQUE (follower_id, following_id);

ALTER TABLE ONLY public.social_graph
    ADD CONSTRAINT social_graph_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.sport_types
    ADD CONSTRAINT sport_types_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.supplement_logs
    ADD CONSTRAINT supplement_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.supplement_logs
    ADD CONSTRAINT supplement_logs_unique_per_day UNIQUE (supplement_id, date);

ALTER TABLE ONLY public.supplements
    ADD CONSTRAINT supplements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_invite_code_key UNIQUE (invite_code);

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_plan_week_unique UNIQUE (plan_id, week);

ALTER TABLE ONLY public.weekly_quotas
    ADD CONSTRAINT weekly_quotas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.weekly_quotas
    ADD CONSTRAINT weekly_quotas_user_sport_unique UNIQUE (user_id, sport_type_id);

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_pkey PRIMARY KEY (id);

CREATE INDEX body_measurements_user_date_idx ON public.body_measurements USING btree (user_id, measured_at DESC);

CREATE INDEX body_photos_user_idx ON public.body_photos USING btree (user_id, created_at DESC);

CREATE INDEX club_members_club_idx ON public.club_members USING btree (club_id);

CREATE UNIQUE INDEX club_members_one_primary_per_user_idx ON public.club_members USING btree (user_id) WHERE (is_primary = true);

CREATE INDEX club_members_user_idx ON public.club_members USING btree (user_id);

CREATE INDEX coach_invite_codes_coach_idx ON public.coach_invite_codes USING btree (coach_id);

CREATE INDEX coach_invite_codes_code_idx ON public.coach_invite_codes USING btree (code);

CREATE INDEX coaching_relationships_coach_idx ON public.coaching_relationships USING btree (coach_id);

CREATE INDEX coaching_relationships_sport_idx ON public.coaching_relationships USING btree (sport_type_id);

CREATE INDEX coaching_relationships_student_idx ON public.coaching_relationships USING btree (student_id);

CREATE INDEX foods_name_trgm_idx ON public.foods USING gin (to_tsvector('simple'::regconfig, name));

CREATE UNIQUE INDEX foods_seed_name_unique ON public.foods USING btree (lower(name)) WHERE (source = 'seed'::text);

CREATE UNIQUE INDEX goals_one_active_per_type ON public.goals USING btree (user_id, goal_type) WHERE (status = 'active'::text);

CREATE INDEX goals_user_status_idx ON public.goals USING btree (user_id, status);

CREATE INDEX idx_profiles_xp ON public.profiles USING btree (xp DESC);

CREATE UNIQUE INDEX logs_plan_item_unique ON public.logs USING btree (plan_item_id) WHERE (plan_item_id IS NOT NULL);

CREATE INDEX meal_logs_user_date_idx ON public.meal_logs USING btree (user_id, date DESC);

CREATE INDEX meal_plan_items_plan_idx ON public.meal_plan_items USING btree (plan_id, day_of_week, sort);

CREATE UNIQUE INDEX meal_plans_one_active ON public.meal_plans USING btree (user_id) WHERE (status = 'active'::text);

CREATE INDEX plan_items_plan_week_idx ON public.plan_items USING btree (plan_id, week, day_of_week);

CREATE INDEX session_logs_user_idx ON public.session_logs USING btree (user_id);

CREATE INDEX social_graph_follower_idx ON public.social_graph USING btree (follower_id);

CREATE INDEX social_graph_following_idx ON public.social_graph USING btree (following_id);

CREATE INDEX supplement_logs_user_date_idx ON public.supplement_logs USING btree (user_id, date);

CREATE UNIQUE INDEX training_plans_one_active_per_kind ON public.training_plans USING btree (user_id, plan_kind) WHERE (status = 'active'::text);

CREATE INDEX training_plans_user_status_idx ON public.training_plans USING btree (user_id, status);

CREATE INDEX weekly_checkins_plan_idx ON public.weekly_checkins USING btree (plan_id, week);

CREATE INDEX xp_transactions_user_created_idx ON public.xp_transactions USING btree (user_id, created_at DESC);

CREATE TRIGGER body_photos_cap BEFORE INSERT ON public.body_photos FOR EACH ROW EXECUTE FUNCTION public.enforce_body_photo_cap();

CREATE TRIGGER profiles_league_tier BEFORE INSERT OR UPDATE OF xp ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_league_tier();

ALTER TABLE ONLY public.body_measurements
    ADD CONSTRAINT body_measurements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.body_photos
    ADD CONSTRAINT body_photos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.club_members
    ADD CONSTRAINT club_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.coach_invite_codes
    ADD CONSTRAINT coach_invite_codes_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.coach_invite_codes
    ADD CONSTRAINT coach_invite_codes_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id);

ALTER TABLE ONLY public.coaching_relationships
    ADD CONSTRAINT coaching_relationships_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.daily_plans
    ADD CONSTRAINT daily_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_days
    ADD CONSTRAINT group_days_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.training_groups(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.training_groups(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES public.plan_items(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id);

ALTER TABLE ONLY public.logs
    ADD CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.meal_logs
    ADD CONSTRAINT meal_logs_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.meal_logs
    ADD CONSTRAINT meal_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meal_plan_items
    ADD CONSTRAINT meal_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.meal_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meal_plan_items
    ADD CONSTRAINT meal_plan_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.meal_plans
    ADD CONSTRAINT meal_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.plan_items
    ADD CONSTRAINT plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id);

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT session_logs_plan_item_id_fkey FOREIGN KEY (plan_item_id) REFERENCES public.plan_items(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.session_logs
    ADD CONSTRAINT session_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.social_graph
    ADD CONSTRAINT social_graph_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.social_graph
    ADD CONSTRAINT social_graph_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.supplement_logs
    ADD CONSTRAINT supplement_logs_supplement_id_fkey FOREIGN KEY (supplement_id) REFERENCES public.supplements(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.supplement_logs
    ADD CONSTRAINT supplement_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.supplements
    ADD CONSTRAINT supplements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.training_groups
    ADD CONSTRAINT training_groups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.weekly_checkins
    ADD CONSTRAINT weekly_checkins_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.weekly_quotas
    ADD CONSTRAINT weekly_quotas_sport_type_id_fkey FOREIGN KEY (sport_type_id) REFERENCES public.sport_types(id);

ALTER TABLE ONLY public.weekly_quotas
    ADD CONSTRAINT weekly_quotas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.xp_transactions
    ADD CONSTRAINT xp_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY body_measurements_delete_self ON public.body_measurements FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY body_measurements_insert_self ON public.body_measurements FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY body_measurements_select_self ON public.body_measurements FOR SELECT TO coachin_app USING ((user_id = app.current_user_id()));

ALTER TABLE public.body_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY body_photos_delete_self ON public.body_photos FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY body_photos_insert_self ON public.body_photos FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY body_photos_select_self ON public.body_photos FOR SELECT TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY body_photos_update_self ON public.body_photos FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY club_members_delete_self ON public.club_members FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY club_members_select_authenticated ON public.club_members FOR SELECT TO coachin_app USING (public.is_club_member(club_id, app.current_user_id()));

CREATE POLICY club_members_update_self ON public.club_members FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY clubs_delete_owner ON public.clubs FOR DELETE TO coachin_app USING ((owner_id = app.current_user_id()));

CREATE POLICY clubs_insert_owner_self ON public.clubs FOR INSERT TO coachin_app WITH CHECK ((owner_id = app.current_user_id()));

CREATE POLICY clubs_select_authenticated ON public.clubs FOR SELECT TO coachin_app USING (true);

CREATE POLICY clubs_update_owner ON public.clubs FOR UPDATE TO coachin_app USING ((owner_id = app.current_user_id())) WITH CHECK ((owner_id = app.current_user_id()));

ALTER TABLE public.coach_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY coach_invite_codes_manage_own ON public.coach_invite_codes TO coachin_app USING ((coach_id = app.current_user_id())) WITH CHECK ((coach_id = app.current_user_id()));

CREATE POLICY coach_invite_codes_select_active ON public.coach_invite_codes FOR SELECT TO coachin_app USING (((is_active = true) AND ((expires_at IS NULL) OR (expires_at > now()))));

ALTER TABLE public.coaching_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY coaching_relationships_delete_related ON public.coaching_relationships FOR DELETE TO coachin_app USING (((coach_id = app.current_user_id()) OR (student_id = app.current_user_id())));

CREATE POLICY coaching_relationships_select_related ON public.coaching_relationships FOR SELECT TO coachin_app USING (((coach_id = app.current_user_id()) OR (student_id = app.current_user_id())));

ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY foods_insert_own ON public.foods FOR INSERT TO coachin_app WITH CHECK (((source = ANY (ARRAY['usda'::text, 'custom'::text])) AND (created_by = app.current_user_id())));

CREATE POLICY foods_select_all ON public.foods FOR SELECT TO coachin_app USING (true);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY goals_insert_self ON public.goals FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY goals_select_self ON public.goals FOR SELECT TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY goals_update_self ON public.goals FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.group_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_days_select_member ON public.group_days FOR SELECT TO coachin_app USING (public.is_group_member(group_id, app.current_user_id()));

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY group_members_select_comember ON public.group_members FOR SELECT TO coachin_app USING (public.is_group_member(group_id, app.current_user_id()));

ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY logs_delete_self ON public.logs FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY logs_insert_self ON public.logs FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY logs_select_self_or_coach ON public.logs FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR (EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = logs.user_id))))));

CREATE POLICY logs_update_self ON public.logs FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_logs_delete_self ON public.meal_logs FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY meal_logs_insert_self ON public.meal_logs FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY meal_logs_select_self_or_coach ON public.meal_logs FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR ((EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = meal_logs.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = meal_logs.user_id) AND p.nutrition_sharing_enabled))))));

ALTER TABLE public.meal_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_plan_items_delete_self ON public.meal_plan_items FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY meal_plan_items_insert_self ON public.meal_plan_items FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY meal_plan_items_select_self_or_coach ON public.meal_plan_items FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR ((EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = meal_plan_items.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = meal_plan_items.user_id) AND p.nutrition_sharing_enabled))))));

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_plans_delete_self ON public.meal_plans FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY meal_plans_insert_self ON public.meal_plans FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY meal_plans_select_self_or_coach ON public.meal_plans FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR ((EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = meal_plans.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = meal_plans.user_id) AND p.nutrition_sharing_enabled))))));

CREATE POLICY meal_plans_update_self ON public.meal_plans FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY plan_items_all_via_plan ON public.plan_items TO coachin_app USING ((EXISTS ( SELECT 1
   FROM public.training_plans p
  WHERE ((p.id = plan_items.plan_id) AND (p.user_id = app.current_user_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.training_plans p
  WHERE ((p.id = plan_items.plan_id) AND (p.user_id = app.current_user_id())))));

CREATE POLICY plan_items_select_coach ON public.plan_items FOR SELECT TO coachin_app USING ((EXISTS ( SELECT 1
   FROM (public.training_plans p
     JOIN public.coaching_relationships cr ON ((cr.student_id = p.user_id)))
  WHERE ((p.id = plan_items.plan_id) AND (cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id())))));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO coachin_app USING (true);

CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO coachin_app USING ((id = app.current_user_id())) WITH CHECK ((id = app.current_user_id()));

ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedules_delete_self_or_coach ON public.schedules FOR DELETE TO coachin_app USING (((user_id = app.current_user_id()) OR (EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = schedules.user_id))))));

CREATE POLICY schedules_insert_self_or_coach ON public.schedules FOR INSERT TO coachin_app WITH CHECK (((user_id = app.current_user_id()) OR (EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = schedules.user_id))))));

CREATE POLICY schedules_select_self_or_related ON public.schedules FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR (EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (((cr.coach_id = app.current_user_id()) AND (cr.student_id = schedules.user_id)) OR ((cr.student_id = app.current_user_id()) AND (cr.coach_id = schedules.user_id))))))));

CREATE POLICY schedules_update_self_or_coach ON public.schedules FOR UPDATE TO coachin_app USING (((user_id = app.current_user_id()) OR (EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = schedules.user_id)))))) WITH CHECK (((user_id = app.current_user_id()) OR (EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = schedules.user_id))))));

ALTER TABLE public.session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY session_logs_insert_self ON public.session_logs FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY session_logs_select_self ON public.session_logs FOR SELECT TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY session_logs_update_self ON public.session_logs FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.social_graph ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_graph_delete_self_follow ON public.social_graph FOR DELETE TO coachin_app USING ((follower_id = app.current_user_id()));

CREATE POLICY social_graph_insert_self_follow ON public.social_graph FOR INSERT TO coachin_app WITH CHECK (((follower_id = app.current_user_id()) AND (following_id <> app.current_user_id())));

CREATE POLICY social_graph_select_related ON public.social_graph FOR SELECT TO coachin_app USING (((follower_id = app.current_user_id()) OR (following_id = app.current_user_id())));

ALTER TABLE public.sport_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY sport_types_select_authenticated ON public.sport_types FOR SELECT TO coachin_app USING (true);

ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplement_logs_delete_self ON public.supplement_logs FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY supplement_logs_insert_self ON public.supplement_logs FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY supplement_logs_select_self_or_coach ON public.supplement_logs FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR ((EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = supplement_logs.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = supplement_logs.user_id) AND p.nutrition_sharing_enabled))))));

ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY supplements_delete_self ON public.supplements FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY supplements_insert_self ON public.supplements FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY supplements_select_self_or_coach ON public.supplements FOR SELECT TO coachin_app USING (((user_id = app.current_user_id()) OR ((EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = supplements.user_id)))) AND (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = supplements.user_id) AND p.nutrition_sharing_enabled))))));

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_groups_select_member ON public.training_groups FOR SELECT TO coachin_app USING (public.is_group_member(id, app.current_user_id()));

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_plans_all_self ON public.training_plans TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY training_plans_select_coach ON public.training_plans FOR SELECT TO coachin_app USING ((EXISTS ( SELECT 1
   FROM public.coaching_relationships cr
  WHERE ((cr.status = 'active'::text) AND (cr.coach_id = app.current_user_id()) AND (cr.student_id = training_plans.user_id)))));

ALTER TABLE public.weekly_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_checkins_all_via_plan ON public.weekly_checkins TO coachin_app USING ((EXISTS ( SELECT 1
   FROM public.training_plans p
  WHERE ((p.id = weekly_checkins.plan_id) AND (p.user_id = app.current_user_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.training_plans p
  WHERE ((p.id = weekly_checkins.plan_id) AND (p.user_id = app.current_user_id())))));

ALTER TABLE public.weekly_quotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_quotas_delete_self ON public.weekly_quotas FOR DELETE TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY weekly_quotas_insert_self ON public.weekly_quotas FOR INSERT TO coachin_app WITH CHECK ((user_id = app.current_user_id()));

CREATE POLICY weekly_quotas_select_self ON public.weekly_quotas FOR SELECT TO coachin_app USING ((user_id = app.current_user_id()));

CREATE POLICY weekly_quotas_update_self ON public.weekly_quotas FOR UPDATE TO coachin_app USING ((user_id = app.current_user_id())) WITH CHECK ((user_id = app.current_user_id()));

ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY xp_transactions_select_self ON public.xp_transactions FOR SELECT TO coachin_app USING ((user_id = app.current_user_id()));

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP FUNCTION IF EXISTS public.sync_league_tier() CASCADE;
DROP FUNCTION IF EXISTS public.leave_training_group(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.league_tier_for_xp(bigint) CASCADE;
DROP FUNCTION IF EXISTS public.join_training_group(text) CASCADE;
DROP FUNCTION IF EXISTS public.join_coaching_via_invite_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.join_club_via_invite_code(text) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_club_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.group_trained_today(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(uuid[], integer) CASCADE;
DROP FUNCTION IF EXISTS public.evaluate_user_streak() CASCADE;
DROP FUNCTION IF EXISTS public.evaluate_group_days(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.enforce_body_photo_cap() CASCADE;
DROP FUNCTION IF EXISTS public.create_training_plan(date, text, integer, text, jsonb, jsonb, text, jsonb, text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_training_group(text) CASCADE;
DROP FUNCTION IF EXISTS public.create_club_with_owner(text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.complete_plan_item(uuid, boolean, date) CASCADE;
DROP FUNCTION IF EXISTS public.award_session_log_xp(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.award_meal_xp(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.award_day_adherence(date) CASCADE;
DROP FUNCTION IF EXISTS public.assign_coach_schedule_to_student(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.apply_week_adjustment(uuid, integer, jsonb, text, text, integer, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.achieve_goal(uuid) CASCADE;
DROP TABLE IF EXISTS public.weekly_quotas CASCADE;
DROP TABLE IF EXISTS public.xp_transactions CASCADE;
DROP TABLE IF EXISTS public.weekly_checkins CASCADE;
DROP TABLE IF EXISTS public.training_plans CASCADE;
DROP TABLE IF EXISTS public.training_groups CASCADE;
DROP TABLE IF EXISTS public.supplements CASCADE;
DROP TABLE IF EXISTS public.supplement_logs CASCADE;
DROP TABLE IF EXISTS public.sport_types CASCADE;
DROP TABLE IF EXISTS public.social_graph CASCADE;
DROP TABLE IF EXISTS public.session_logs CASCADE;
DROP TABLE IF EXISTS public.schedules CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.plan_items CASCADE;
DROP TABLE IF EXISTS public.meal_plans CASCADE;
DROP TABLE IF EXISTS public.meal_plan_items CASCADE;
DROP TABLE IF EXISTS public.meal_logs CASCADE;
DROP TABLE IF EXISTS public.logs CASCADE;
DROP TABLE IF EXISTS public.group_members CASCADE;
DROP TABLE IF EXISTS public.group_days CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.foods CASCADE;
DROP TABLE IF EXISTS public.daily_plans CASCADE;
DROP TABLE IF EXISTS public.coaching_relationships CASCADE;
DROP TABLE IF EXISTS public.coach_invite_codes CASCADE;
DROP TABLE IF EXISTS public.clubs CASCADE;
DROP TABLE IF EXISTS public.club_members CASCADE;
DROP TABLE IF EXISTS public.body_photos CASCADE;
DROP TABLE IF EXISTS public.body_measurements CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TYPE IF EXISTS public.log_status;
DROP EXTENSION IF EXISTS citext;
-- +goose StatementEnd
