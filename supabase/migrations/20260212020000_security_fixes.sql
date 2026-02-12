-- Security fixes for coaching relationships and club memberships

-- 1) SECURITY DEFINER function to join coaching relationships via invite code
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
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Validate and fetch invite code
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

  -- Insert coaching relationship
  INSERT INTO public.coaching_relationships (coach_id, student_id, sport_type_id, status)
  VALUES (v_invite.coach_id, v_user_id, v_invite.sport_type_id, 'active')
  ON CONFLICT (coach_id, student_id, sport_type_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.join_coaching_via_invite_code(text) TO authenticated;

-- 2) SECURITY DEFINER function to join club via invite code
CREATE OR REPLACE FUNCTION public.join_club_via_invite_code(
  p_invite_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_user_id uuid;
  v_has_primary boolean;
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
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
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.join_club_via_invite_code(text) TO authenticated;

-- 3) Revoke direct INSERT on coaching_relationships and club_members
-- Users should only join via the SECURITY DEFINER functions above
DROP POLICY IF EXISTS coaching_relationships_insert_student_self ON public.coaching_relationships;
DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;

-- 4) Prevent authenticated users from updating sensitive membership columns directly
REVOKE UPDATE (club_id, role, user_id) ON public.club_members FROM authenticated;

-- Allow updating only is_primary via controlled policy
DROP POLICY IF EXISTS club_members_update_self ON public.club_members;
CREATE POLICY club_members_update_self
ON public.club_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5) Restrict club_members SELECT to only memberships in clubs the user belongs to
DROP POLICY IF EXISTS club_members_select_authenticated ON public.club_members;
CREATE POLICY club_members_select_authenticated
ON public.club_members
FOR SELECT
TO authenticated
USING (
  club_id IN (
    SELECT club_id
    FROM public.club_members
    WHERE user_id = auth.uid()
  )
);

-- 6) Restrict profiles SELECT to only self and users in same club
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR id IN (
    SELECT DISTINCT cm2.user_id
    FROM public.club_members cm1
    JOIN public.club_members cm2 ON cm1.club_id = cm2.club_id
    WHERE cm1.user_id = auth.uid()
  )
  OR id IN (
    SELECT following_id
    FROM public.social_graph
    WHERE follower_id = auth.uid()
  )
  OR id IN (
    SELECT follower_id
    FROM public.social_graph
    WHERE following_id = auth.uid()
  )
  OR id IN (
    SELECT coach_id
    FROM public.coaching_relationships
    WHERE student_id = auth.uid()
  )
  OR id IN (
    SELECT student_id
    FROM public.coaching_relationships
    WHERE coach_id = auth.uid()
  )
);

-- 7) Create optimized view for weekly leaderboard aggregation
CREATE OR REPLACE VIEW public.weekly_leaderboard AS
SELECT
  user_id,
  SUM(amount) as weekly_xp
FROM public.xp_transactions
WHERE created_at >= (now() - interval '7 days')
GROUP BY user_id;

-- Grant select on view to authenticated users
GRANT SELECT ON public.weekly_leaderboard TO authenticated;

-- 8) Create RPC function for efficient weekly leaderboard
CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(
  p_user_ids uuid[] DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  level int,
  weekly_xp bigint
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.level,
    COALESCE(wl.weekly_xp, 0) as weekly_xp
  FROM public.profiles p
  LEFT JOIN public.weekly_leaderboard wl ON p.id = wl.user_id
  WHERE
    (p_user_ids IS NULL OR p.id = ANY(p_user_ids))
  ORDER BY COALESCE(wl.weekly_xp, 0) DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(uuid[], int) TO authenticated;
