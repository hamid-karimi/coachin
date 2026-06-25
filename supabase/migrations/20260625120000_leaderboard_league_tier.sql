-- Add the real profiles.league_tier column to the weekly leaderboard RPC so the
-- community leaderboard can display actual league tiers instead of approximating
-- them. A return-type change cannot be done with CREATE OR REPLACE, so we drop
-- and recreate the function (and re-apply its grant).

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

-- Grant execute to authenticated users (grants are dropped with the function)
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(uuid[], int) TO authenticated;
