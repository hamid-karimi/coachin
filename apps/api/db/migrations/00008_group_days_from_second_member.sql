-- +goose Up
-- A new group's first evaluation started at yesterday, so a group created today
-- could earn a streak day (and every member the group bonus) for a day before it
-- existed — repeatable by creating fresh groups. Settle from the day the group
-- got its 2nd member instead.
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.evaluate_group_days(p_group_id uuid) RETURNS jsonb
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

  -- The first settled day is the day the group got its 2nd member (legacy started
  -- at yesterday, so a brand-new group could be paid for a day before it existed).
  v_day := COALESCE(v_group.last_evaluated_date + 1, (
    SELECT joined_at::date FROM public.group_members
    WHERE group_id = p_group_id ORDER BY joined_at OFFSET 1 LIMIT 1
  ));

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
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE OR REPLACE FUNCTION public.evaluate_group_days(p_group_id uuid) RETURNS jsonb
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
-- +goose StatementEnd
