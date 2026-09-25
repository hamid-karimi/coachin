-- name: ListClubMemberships :many
SELECT cm.club_id, c.name, c.invite_code, COALESCE(cm.role, 'member')::text AS role, cm.is_primary
FROM public.club_members cm JOIN public.clubs c ON c.id = cm.club_id
WHERE cm.user_id = sqlc.arg(user_id)
ORDER BY cm.joined_at;

-- name: ListFollowing :many
SELECT following_id FROM public.social_graph WHERE follower_id = sqlc.arg(user_id) AND following_id IS NOT NULL;

-- name: ListClubMemberIDs :many
SELECT user_id FROM public.club_members WHERE club_id = sqlc.arg(club_id);

-- name: TotalXPBoard :many
-- Lifetime-XP ranking (all users when ids is NULL).
SELECT id, full_name, avatar_url, COALESCE(level, 1)::bigint AS level, league_tier, COALESCE(xp, 0)::bigint AS xp
FROM public.profiles
WHERE sqlc.narg(ids)::uuid[] IS NULL OR id = ANY(sqlc.narg(ids)::uuid[])
ORDER BY xp DESC NULLS LAST
LIMIT sqlc.arg(max_rows)::int;

-- name: CreateClubWithOwner :one
SELECT public.create_club_with_owner(sqlc.arg(name), sqlc.arg(description), sqlc.arg(code))::text;

-- name: JoinClubByCode :one
SELECT public.join_club_via_invite_code(sqlc.arg(code))::text;

-- name: IsClubMember :one
SELECT EXISTS (SELECT 1 FROM public.club_members WHERE club_id = sqlc.arg(club_id) AND user_id = sqlc.arg(user_id))::bool AS member;

-- name: ClearPrimaryClub :exec
UPDATE public.club_members SET is_primary = false WHERE user_id = sqlc.arg(user_id) AND is_primary;

-- name: MarkPrimaryClub :exec
UPDATE public.club_members SET is_primary = true WHERE user_id = sqlc.arg(user_id) AND club_id = sqlc.arg(club_id);

-- name: DeleteClubMembership :one
DELETE FROM public.club_members WHERE user_id = sqlc.arg(user_id) AND club_id = sqlc.arg(club_id)
RETURNING is_primary;

-- name: PromoteNextPrimaryClub :exec
UPDATE public.club_members SET is_primary = true
WHERE id = (SELECT m.id FROM public.club_members m WHERE m.user_id = sqlc.arg(user_id) ORDER BY m.joined_at LIMIT 1);
