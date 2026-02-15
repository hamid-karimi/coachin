-- Ensure join_coaching_via_invite_code returns deterministic statuses
-- so the app can distinguish new joins from existing relationships.

CREATE OR REPLACE FUNCTION public.join_coaching_via_invite_code(
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_existing_status text;
BEGIN
  v_user_id := auth.uid();
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

GRANT EXECUTE ON FUNCTION public.join_coaching_via_invite_code(text) TO authenticated;
