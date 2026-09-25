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
FROM public.profile_cards
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

-- name: ListFollowingProfiles :many
SELECT p.id, p.full_name, p.avatar_url, COALESCE(p.level, 1)::bigint AS level, p.league_tier, COALESCE(p.xp, 0)::bigint AS xp
FROM public.social_graph g JOIN public.profile_cards p ON p.id = g.following_id
WHERE g.follower_id = sqlc.arg(user_id)
ORDER BY g.created_at;

-- name: ListMyCoaches :many
SELECT p.id, p.full_name, p.avatar_url, COALESCE(p.level, 1)::bigint AS level, p.league_tier, st.name AS sport_name
FROM public.coaching_relationships cr JOIN public.profiles p ON p.id = cr.coach_id
LEFT JOIN public.sport_types st ON st.id = cr.sport_type_id
WHERE cr.student_id = sqlc.arg(user_id) AND cr.status = 'active'
ORDER BY cr.created_at;

-- name: SearchPeople :many
-- Name contains the term (wildcards literal), or the exact email; never the
-- caller. Top lifetime XP first.
SELECT p.id, p.full_name, p.avatar_url, COALESCE(p.level, 1)::bigint AS level, p.league_tier, COALESCE(p.xp, 0)::bigint AS xp,
       EXISTS (SELECT 1 FROM public.social_graph g WHERE g.follower_id = sqlc.arg(user_id) AND g.following_id = p.id)::bool AS following
FROM public.profile_cards p
WHERE p.id <> sqlc.arg(user_id)
  AND (sqlc.arg(term)::text = ''
       OR p.full_name ILIKE '%' || replace(replace(replace(sqlc.arg(term)::text, '\', '\\'), '%', '\%'), '_', '\_') || '%'
       OR p.id = public.user_id_by_email(sqlc.arg(term)::text))
ORDER BY p.xp DESC NULLS LAST, p.id
LIMIT sqlc.arg(max_rows)::int OFFSET sqlc.arg(skip)::int;

-- name: ProfileExists :one
SELECT EXISTS (SELECT 1 FROM public.profile_cards WHERE id = sqlc.arg(id))::bool AS found;

-- name: InsertFollow :exec
INSERT INTO public.social_graph (follower_id, following_id) VALUES (sqlc.arg(follower_id), sqlc.arg(following_id));

-- name: DeleteFollow :execrows
DELETE FROM public.social_graph WHERE follower_id = sqlc.arg(follower_id) AND following_id = sqlc.arg(following_id);

-- name: MyGroupIDs :many
SELECT group_id FROM public.group_members WHERE user_id = sqlc.arg(user_id) ORDER BY joined_at;

-- name: EvaluateGroupDays :one
-- Settles past days (streak + member bonus XP, FORMULAS §2 Group streak); idempotent.
SELECT public.evaluate_group_days(sqlc.arg(group_id))::text;

-- name: GroupsByIDs :many
SELECT id, name, invite_code, streak_count, best_streak FROM public.training_groups
WHERE id = ANY(sqlc.arg(ids)::uuid[]) ORDER BY created_at;

-- name: GroupMembers :many
SELECT gm.group_id, p.id, p.full_name, p.avatar_url
FROM public.group_members gm JOIN public.profile_cards p ON p.id = gm.user_id
WHERE gm.group_id = ANY(sqlc.arg(ids)::uuid[])
ORDER BY gm.joined_at;

-- name: RecentGroupDays :many
SELECT group_id, date::text AS on_date, all_trained FROM public.group_days
WHERE group_id = ANY(sqlc.arg(ids)::uuid[]) AND date >= CAST(sqlc.arg(from_date)::text AS date)
ORDER BY date;

-- name: GroupTrainedToday :one
SELECT public.group_trained_today(sqlc.arg(group_id))::uuid[] AS ids;

-- name: CreateTrainingGroup :one
SELECT public.create_training_group(sqlc.arg(name))::text;

-- name: JoinTrainingGroup :one
SELECT public.join_training_group(sqlc.arg(code))::text;

-- name: LeaveTrainingGroup :one
SELECT public.leave_training_group(sqlc.arg(group_id))::text;

-- name: LoggedAnythingOn :one
SELECT EXISTS (SELECT 1 FROM public.logs WHERE user_id = sqlc.arg(user_id) AND date = CAST(sqlc.arg(on_date)::text AS date))::bool AS logged;

-- name: TopStreakGroup :one
-- The user's group with the longest live streak (the Today nudge).
SELECT g.name, g.streak_count FROM public.group_members gm JOIN public.training_groups g ON g.id = gm.group_id
WHERE gm.user_id = sqlc.arg(user_id) AND g.streak_count > 0
ORDER BY g.streak_count DESC, g.created_at
LIMIT 1;
