-- Create RPC function for atomic club creation with owner membership
CREATE OR REPLACE FUNCTION public.create_club_with_owner(
  p_club_name text,
  p_club_description text,
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_club_id uuid;
  v_has_primary boolean;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate club name
  IF LENGTH(TRIM(p_club_name)) < 3 THEN
    RETURN jsonb_build_object('error', 'Club name must be at least 3 characters');
  END IF;

  -- Create the club
  INSERT INTO public.clubs (name, description, owner_id, invite_code)
  VALUES (
    TRIM(p_club_name),
    NULLIF(TRIM(p_club_description), ''),
    v_user_id,
    UPPER(TRIM(p_invite_code))
  )
  RETURNING id INTO v_club_id;

  -- Check if user has a primary club
  SELECT EXISTS(
    SELECT 1
    FROM public.club_members
    WHERE user_id = v_user_id AND is_primary = true
  ) INTO v_has_primary;

  -- Add owner membership (this happens atomically with club creation)
  INSERT INTO public.club_members (club_id, user_id, role, is_primary)
  VALUES (v_club_id, v_user_id, 'owner', NOT v_has_primary);

  RETURN jsonb_build_object(
    'success', true,
    'club_id', v_club_id,
    'invite_code', UPPER(TRIM(p_invite_code))
  );
EXCEPTION
  WHEN unique_violation THEN
    -- This handles the invite_code uniqueness constraint
    RETURN jsonb_build_object('error', 'Invite code already exists');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_club_with_owner(text, text, text) TO authenticated;

-- Create RPC function for atomic schedule assignment from coach to student
CREATE OR REPLACE FUNCTION public.assign_coach_schedule_to_student(
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coach_id uuid;
  v_schedule_count int;
BEGIN
  -- Get current user (coach)
  v_coach_id := auth.uid();
  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Verify active coaching relationship exists
  IF NOT EXISTS(
    SELECT 1
    FROM public.coaching_relationships
    WHERE coach_id = v_coach_id
      AND student_id = p_student_id
      AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('error', 'No active coaching relationship found');
  END IF;

  -- Check if coach has schedules
  SELECT COUNT(*)
  INTO v_schedule_count
  FROM public.schedules
  WHERE user_id = v_coach_id;

  IF v_schedule_count = 0 THEN
    RETURN jsonb_build_object('error', 'Coach has no schedule to assign');
  END IF;

  -- Delete student's existing schedules
  DELETE FROM public.schedules
  WHERE user_id = p_student_id;

  -- Copy coach's schedules to student (both operations are atomic)
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
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_coach_schedule_to_student(uuid) TO authenticated;
