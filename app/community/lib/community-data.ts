import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type {
  ClubMembershipSummary,
  CoachInviteCodeSummary,
  CoachRelationship,
  ProfileSummary,
  SportTypeSummary,
  StudentRelationship,
} from "../types";

export type CommunityData = {
  user: User;
  profileRole: string;
  globalLeaderboard: ProfileSummary[];
  myClubLeaderboard: ProfileSummary[];
  myCircleLeaderboard: ProfileSummary[];
  coaches: CoachRelationship[];
  students: StudentRelationship[];
  coachStudentsLeaderboard: ProfileSummary[];
  sportTypes: SportTypeSummary[];
  coachInviteCodes: CoachInviteCodeSummary[];
  clubMemberships: ClubMembershipSummary[];
  primaryClubName: string | null;
  followingUserIds: string[];
  followingProfiles: ProfileSummary[];
  discoverProfiles: ProfileSummary[];
  discoverPage: number;
  discoverHasNextPage: boolean;
};

const normalizeSportTypes = (
  rows: Array<{ id: number; name: string | null }> | null,
): SportTypeSummary[] => {
  if (!rows) {
    return [];
  }

  return rows
    .filter((row) => Boolean(row?.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
    }));
};

const normalizeCoaches = (
  items: Array<{
    coach: ProfileSummary | ProfileSummary[];
    sport_types: unknown;
  }> | null,
): CoachRelationship[] => {
  if (!items) {
    return [];
  }

  return items
    .map((item) => {
      const coach = Array.isArray(item.coach) ? item.coach[0] : item.coach;
      return {
        coach,
        sport_types: item.sport_types,
      };
    })
    .filter((item) => item?.coach?.id)
    .map((item) => ({
      coach: {
        id: item.coach.id,
        email: item.coach.email ?? null,
        full_name: item.coach.full_name ?? null,
        xp: item.coach.xp ?? null,
        level: item.coach.level ?? null,
        avatar_url: item.coach.avatar_url ?? null,
      },
      sport_type:
        typeof item.sport_types === "object" && item.sport_types !== null
          ? (item.sport_types as SportTypeSummary)
          : null,
    }));
};

const normalizeStudents = (
  items: Array<{
    student: ProfileSummary | ProfileSummary[];
    sport_types: unknown;
  }> | null,
): StudentRelationship[] => {
  if (!items) {
    return [];
  }

  return items
    .map((item) => {
      const student = Array.isArray(item.student)
        ? item.student[0]
        : item.student;

      return {
        student,
        sport_types: item.sport_types,
      };
    })
    .filter((item) => item?.student?.id)
    .map((item) => ({
      student: {
        id: item.student.id,
        email: item.student.email ?? null,
        full_name: item.student.full_name ?? null,
        xp: item.student.xp ?? null,
        level: item.student.level ?? null,
        avatar_url: item.student.avatar_url ?? null,
      },
      sport_type:
        typeof item.sport_types === "object" && item.sport_types !== null
          ? (item.sport_types as SportTypeSummary)
          : null,
    }));
};

const buildWeeklyLeaderboard = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds?: string[],
): Promise<ProfileSummary[]> => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let txQuery = supabase
    .from("xp_transactions")
    .select("user_id, amount")
    .gte("created_at", since);

  if (userIds && userIds.length > 0) {
    txQuery = txQuery.in("user_id", userIds);
  }

  const { data: txRows } = await txQuery;

  if (!txRows || txRows.length === 0) {
    return [];
  }

  const totals = new Map<string, number>();

  for (const row of txRows) {
    const userId = row.user_id as string | null;
    const amount = Number(row.amount ?? 0);

    if (!userId) {
      continue;
    }

    totals.set(userId, (totals.get(userId) ?? 0) + amount);
  }

  const leaderboardUserIds = [...totals.keys()];

  if (leaderboardUserIds.length === 0) {
    return [];
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, level")
    .in("id", leaderboardUserIds);

  if (!profiles) {
    return [];
  }

  return profiles
    .filter((profile) => profile?.id)
    .map((profile) => ({
      id: profile.id,
      email: profile.email ?? null,
      full_name: profile.full_name ?? null,
      avatar_url: profile.avatar_url ?? null,
      level: profile.level ?? 1,
      xp: totals.get(profile.id) ?? 0,
      weekly_xp: totals.get(profile.id) ?? 0,
    }))
    .sort((first, second) => (second.weekly_xp ?? 0) - (first.weekly_xp ?? 0));
};

const normalizeClubMemberships = (
  rows: Array<{
    club_id: string;
    is_primary: boolean;
    clubs:
      | { id: string; name: string; invite_code: string }
      | Array<{ id: string; name: string; invite_code: string }>
      | null;
  }> | null,
): ClubMembershipSummary[] => {
  if (!rows) {
    return [];
  }

  return rows
    .map((row) => {
      const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;

      return {
        club_id: club?.id ?? row.club_id,
        club_name: club?.name ?? "کلاب",
        club_invite_code: club?.invite_code ?? "",
        is_primary: row.is_primary,
      };
    })
    .filter((row) => Boolean(row.club_id));
};

const normalizeInviteCodes = (
  rows: Array<{
    code: string;
    is_active: boolean;
    expires_at: string | null;
    sport_types:
      | { id: number; name: string }
      | Array<{ id: number; name: string }>
      | null;
  }> | null,
): CoachInviteCodeSummary[] => {
  if (!rows) {
    return [];
  }

  return rows.map((row) => {
    const sportType = Array.isArray(row.sport_types)
      ? row.sport_types[0]
      : row.sport_types;

    return {
      code: row.code,
      is_active: row.is_active,
      expires_at: row.expires_at,
      sport_type: sportType
        ? {
            id: sportType.id,
            name: sportType.name,
          }
        : null,
    };
  });
};

const sanitizeSearchTerm = (value: string) =>
  value.replace(/[%(),]/g, " ").trim();

export async function getCommunityData(
  searchTerm?: string,
  discoverPageInput = 1,
): Promise<CommunityData> {
  const discoverPage = Number.isNaN(discoverPageInput)
    ? 1
    : Math.max(1, discoverPageInput);
  const discoverPageSize = 10;
  const discoverFrom = (discoverPage - 1) * discoverPageSize;
  const discoverTo = discoverFrom + discoverPageSize;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const profileRole = profileData?.role ?? "student";

  const { data: coachesData } = await supabase
    .from("coaching_relationships")
    .select(
      "coach:profiles(id, email, xp, level, full_name, avatar_url), sport_types(id, name)",
    )
    .eq("student_id", user.id)
    .eq("status", "active");

  const { data: studentsData } = await supabase
    .from("coaching_relationships")
    .select(
      "student:profiles(id, email, xp, level, full_name, avatar_url), sport_types(id, name)",
    )
    .eq("coach_id", user.id)
    .eq("status", "active");

  const { data: sportTypesData } = await supabase
    .from("sport_types")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: coachInviteCodesData } = await supabase
    .from("coach_invite_codes")
    .select("code, is_active, expires_at, sport_types(id, name)")
    .eq("coach_id", user.id)
    .order("updated_at", { ascending: false });

  const { data: clubMembershipsData } = await supabase
    .from("club_members")
    .select("club_id, is_primary, clubs(id, name, invite_code)")
    .eq("user_id", user.id);

  const { data: followingRows } = await supabase
    .from("social_graph")
    .select("following_id")
    .eq("follower_id", user.id);

  const normalizedCoaches = normalizeCoaches(
    (coachesData as Array<{ coach: ProfileSummary[]; sport_types: unknown }>) ??
      null,
  );

  const normalizedStudents = normalizeStudents(
    (studentsData as Array<{
      student: ProfileSummary[];
      sport_types: unknown;
    }>) ?? null,
  );

  const normalizedClubMemberships = normalizeClubMemberships(
    clubMembershipsData as Array<{
      club_id: string;
      is_primary: boolean;
      clubs:
        | { id: string; name: string; invite_code: string }
        | Array<{ id: string; name: string; invite_code: string }>
        | null;
    }> | null,
  );

  const primaryClubMembership =
    normalizedClubMemberships.find((membership) => membership.is_primary) ??
    normalizedClubMemberships[0] ??
    null;

  const followingIds = (followingRows ?? [])
    .map((row) => row.following_id)
    .filter((id): id is string => Boolean(id));

  const { data: followingProfilesData } = followingIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name, xp, level, avatar_url")
        .in("id", followingIds)
    : { data: [] as ProfileSummary[] };

  let discoverQuery = supabase
    .from("profiles")
    .select("id, email, full_name, xp, level, avatar_url")
    .neq("id", user.id)
    .order("xp", { ascending: false })
    .range(discoverFrom, discoverTo);

  const trimmedSearchTerm = searchTerm?.trim();
  const safeSearchTerm = trimmedSearchTerm
    ? sanitizeSearchTerm(trimmedSearchTerm)
    : "";

  if (safeSearchTerm) {
    discoverQuery = discoverQuery.or(
      `full_name.ilike.%${safeSearchTerm}%,email.ilike.%${safeSearchTerm}%`,
    );
  }

  const { data: discoverProfilesData } = await discoverQuery;
  const discoverProfiles =
    (discoverProfilesData as ProfileSummary[] | null) ?? [];
  const discoverHasNextPage = discoverProfiles.length > discoverPageSize;

  const globalLeaderboard = (await buildWeeklyLeaderboard(supabase)).slice(
    0,
    50,
  );
  const myCircleLeaderboard = followingIds.length
    ? await buildWeeklyLeaderboard(supabase, followingIds)
    : [];

  let myClubLeaderboard: ProfileSummary[] = [];

  if (primaryClubMembership?.club_id) {
    const { data: clubMemberRows } = await supabase
      .from("club_members")
      .select("user_id")
      .eq("club_id", primaryClubMembership.club_id);

    const clubUserIds = (clubMemberRows ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id));

    if (clubUserIds.length > 0) {
      myClubLeaderboard = await buildWeeklyLeaderboard(supabase, clubUserIds);
    }
  }

  const coachStudentsLeaderboard = [...normalizedStudents]
    .map((item) => item.student)
    .sort((first, second) => (second.xp ?? 0) - (first.xp ?? 0));

  return {
    user,
    profileRole,
    globalLeaderboard,
    myClubLeaderboard,
    myCircleLeaderboard,
    coaches: normalizedCoaches,
    students: normalizedStudents,
    coachStudentsLeaderboard,
    sportTypes: normalizeSportTypes(
      sportTypesData as Array<{ id: number; name: string | null }> | null,
    ),
    coachInviteCodes: normalizeInviteCodes(
      coachInviteCodesData as Array<{
        code: string;
        is_active: boolean;
        expires_at: string | null;
        sport_types:
          | { id: number; name: string }
          | Array<{ id: number; name: string }>
          | null;
      }> | null,
    ),
    clubMemberships: normalizedClubMemberships,
    primaryClubName: primaryClubMembership?.club_name ?? null,
    followingUserIds: followingIds,
    followingProfiles: (followingProfilesData as ProfileSummary[] | null) ?? [],
    discoverProfiles: discoverProfiles.slice(0, discoverPageSize),
    discoverPage,
    discoverHasNextPage,
  };
}
