-- Supabase security-advisor fixes.
--
-- The live DB drifted from the migrations: RLS is DISABLED on clubs,
-- club_members, coaching_relationships (it was enabled in the initial
-- schema — most likely switched off to work around the infinite-recursion
-- bug in club_members_select_authenticated, which queries club_members
-- inside its own policy). sport_types never had RLS. And the
-- weekly_leaderboard view runs with definer rights, leaking every user's
-- weekly XP through PostgREST while get_weekly_leaderboard silently
-- depends on that leak.
--
-- This migration makes re-enabling RLS safe (recursion-free policies via a
-- SECURITY DEFINER helper — same pattern as is_group_member), re-enables it
-- everywhere, and flips the view/function security so the sanctioned
-- cross-user path is the RPC, not the view.

-- ─── 1) Recursion-safe club membership helper ────────────────────────────
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_club_member(uuid, uuid) TO authenticated;

-- ─── 2) club_members policies (recreated, recursion-free) ────────────────
-- INSERT stays revoked: joining happens only through the SECURITY DEFINER
-- RPCs (join_club_via_invite_code / create_club_with_owner) per the
-- 20260212020000 security fixes.
DROP POLICY IF EXISTS club_members_select_authenticated ON public.club_members;
CREATE POLICY club_members_select_authenticated
ON public.club_members
FOR SELECT
TO authenticated
USING (public.is_club_member(club_id, auth.uid()));

DROP POLICY IF EXISTS club_members_insert_self ON public.club_members;

DROP POLICY IF EXISTS club_members_update_self ON public.club_members;
CREATE POLICY club_members_update_self
ON public.club_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS club_members_delete_self ON public.club_members;
CREATE POLICY club_members_delete_self
ON public.club_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- ─── 3) clubs policies (recreated verbatim from 20260212010000) ──────────
DROP POLICY IF EXISTS clubs_select_authenticated ON public.clubs;
CREATE POLICY clubs_select_authenticated
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS clubs_insert_owner_self ON public.clubs;
CREATE POLICY clubs_insert_owner_self
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS clubs_update_owner ON public.clubs;
CREATE POLICY clubs_update_owner
ON public.clubs
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS clubs_delete_owner ON public.clubs;
CREATE POLICY clubs_delete_owner
ON public.clubs
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ─── 4) coaching_relationships policies (INSERT stays RPC-only) ──────────
DROP POLICY IF EXISTS coaching_relationships_select_related ON public.coaching_relationships;
CREATE POLICY coaching_relationships_select_related
ON public.coaching_relationships
FOR SELECT
TO authenticated
USING (coach_id = auth.uid() OR student_id = auth.uid());

DROP POLICY IF EXISTS coaching_relationships_insert_student_self ON public.coaching_relationships;

DROP POLICY IF EXISTS coaching_relationships_delete_related ON public.coaching_relationships;
CREATE POLICY coaching_relationships_delete_related
ON public.coaching_relationships
FOR DELETE
TO authenticated
USING (coach_id = auth.uid() OR student_id = auth.uid());

-- ─── 5) sport_types: read-only lookup table ──────────────────────────────
DROP POLICY IF EXISTS sport_types_select_authenticated ON public.sport_types;
CREATE POLICY sport_types_select_authenticated
ON public.sport_types
FOR SELECT
TO authenticated
USING (true);
-- No insert/update/delete policies: sport_types is seeded/admin-managed.

-- ─── 6) Re-enable RLS ─────────────────────────────────────────────────────
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sport_types ENABLE ROW LEVEL SECURITY;

-- ─── 7) weekly_leaderboard: invoker view + definer RPC ────────────────────
-- The view now respects the querying user's RLS (a direct SELECT returns
-- only your own xp rows — no more leaking everyone's weekly XP). The RPC
-- becomes SECURITY DEFINER: the one audited path for cross-user weekly XP,
-- matching every other privileged RPC in this schema.
ALTER VIEW public.weekly_leaderboard SET (security_invoker = on);

DROP FUNCTION IF EXISTS public.get_weekly_leaderboard(uuid[], int);

CREATE FUNCTION public.get_weekly_leaderboard(
  p_user_ids uuid[] DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  avatar_url text,
  level int,
  league_tier text,
  weekly_xp bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(uuid[], int) TO authenticated;
