-- +goose Up
-- Phase 5.2 (security review): every signed-in user could read every profile row —
-- email, birth date, weight, body fat, training history. Profiles are now readable
-- by their owner and by the other side of an active coaching relationship (coaches
-- plan from the trainee's body data; trainees see their coach). Everyone else gets
-- the public card through profile_cards: name, avatar, XP, level, tier.
DROP POLICY profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_self_or_coaching ON public.profiles FOR SELECT TO coachin_app
USING (
  id = app.current_user_id()
  OR EXISTS (
    SELECT 1 FROM public.coaching_relationships cr
    WHERE cr.status = 'active'
      AND ((cr.coach_id = app.current_user_id() AND cr.student_id = profiles.id)
        OR (cr.student_id = app.current_user_id() AND cr.coach_id = profiles.id))
  )
);

-- Runs with its owner's rights (no RLS), so it is read-only for the API role: a
-- simple view is auto-updatable, and default privileges would grant writes.
CREATE VIEW public.profile_cards WITH (security_barrier) AS
SELECT id, full_name, avatar_url, xp, level, league_tier FROM public.profiles;
REVOKE ALL ON public.profile_cards FROM coachin_app;
GRANT SELECT ON public.profile_cards TO coachin_app;

-- People search finds a person by their exact address without reading emails.
-- +goose StatementBegin
CREATE FUNCTION public.user_id_by_email(p_email text) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
$$;
-- +goose StatementEnd

-- Clubs were readable by everyone, invite codes included (anyone could join any
-- club). Joining by code runs in join_club_via_invite_code; reads are members only.
DROP POLICY clubs_select_authenticated ON public.clubs;
CREATE POLICY clubs_select_member ON public.clubs FOR SELECT TO coachin_app
USING (owner_id = app.current_user_id() OR public.is_club_member(id, app.current_user_id()));

-- The weekly leaderboard (callable with any ids) returned every user's email;
-- nothing reads it — the rows are public cards now.
DROP FUNCTION public.get_weekly_leaderboard(uuid[], integer);
-- +goose StatementBegin
CREATE FUNCTION public.get_weekly_leaderboard(p_user_ids uuid[] DEFAULT NULL::uuid[], p_limit integer DEFAULT 50) RETURNS TABLE(id uuid, full_name text, avatar_url text, level integer, league_tier text, weekly_xp bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
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
-- +goose StatementEnd

-- +goose Down
DROP FUNCTION public.get_weekly_leaderboard(uuid[], integer);
-- +goose StatementBegin
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
-- +goose StatementEnd

DROP POLICY clubs_select_member ON public.clubs;
CREATE POLICY clubs_select_authenticated ON public.clubs FOR SELECT TO coachin_app USING (true);
DROP FUNCTION public.user_id_by_email(text);
DROP VIEW public.profile_cards;
DROP POLICY profiles_select_self_or_coaching ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO coachin_app USING (true);
