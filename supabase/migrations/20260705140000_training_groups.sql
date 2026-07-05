-- Group accountability boards (roadmap branch 6).
-- Mechanic (user-approved): everyone always keeps their own XP; the group
-- shares a streak that grows and pays a rising bonus only on days when EVERY
-- member logged a completed workout. A skipper FREEZES the streak (no reset,
-- no bonus). Never punitive.

CREATE TABLE IF NOT EXISTS public.training_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (LENGTH(TRIM(name)) BETWEEN 3 AND 60),
  invite_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  streak_count int NOT NULL DEFAULT 0,
  best_streak int NOT NULL DEFAULT 0,
  last_evaluated_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT training_groups_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_days (
  group_id uuid NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  date date NOT NULL,
  all_trained boolean NOT NULL,
  CONSTRAINT group_days_pkey PRIMARY KEY (group_id, date)
);

-- SECURITY DEFINER membership check: policies on group_members cannot query
-- group_members directly (RLS self-recursion) — this helper bypasses RLS.
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

ALTER TABLE public.training_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS training_groups_select_member ON public.training_groups;
CREATE POLICY training_groups_select_member
ON public.training_groups FOR SELECT TO authenticated
USING (public.is_group_member(id, auth.uid()));

DROP POLICY IF EXISTS group_members_select_comember ON public.group_members;
CREATE POLICY group_members_select_comember
ON public.group_members FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS group_days_select_member ON public.group_days;
CREATE POLICY group_days_select_member
ON public.group_days FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

-- Mutations happen ONLY through the RPCs below (no INSERT/UPDATE policies).

-- Create a group (creator joins automatically).
CREATE OR REPLACE FUNCTION public.create_training_group(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_group_id uuid;
  v_code text;
BEGIN
  v_user_id := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.create_training_group(text) TO authenticated;

-- Join by invite code (max 10 members).
CREATE OR REPLACE FUNCTION public.join_training_group(p_invite_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_group record;
  v_members int;
BEGIN
  v_user_id := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.join_training_group(text) TO authenticated;

-- Leave a group; the group is deleted when its last member leaves.
CREATE OR REPLACE FUNCTION public.leave_training_group(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_remaining int;
BEGIN
  v_user_id := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.leave_training_group(uuid) TO authenticated;

-- Lazy evaluation: settle every un-evaluated day up to YESTERDAY. Idempotent
-- (group_days PK + row lock). A full day (every member has a completed log)
-- extends the streak and pays each member LEAST(10 + streak*2, 50) XP; a
-- missed day records all_trained=false and FREEZES the streak (no reset).
CREATE OR REPLACE FUNCTION public.evaluate_group_days(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_user_id := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.evaluate_group_days(uuid) TO authenticated;

-- Members cannot read each other's logs (RLS is self-or-coach), so the
-- "trained today" dots come from this membership-guarded helper.
CREATE OR REPLACE FUNCTION public.group_trained_today(p_group_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_result uuid[];
BEGIN
  v_user_id := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.group_trained_today(uuid) TO authenticated;
