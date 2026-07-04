import { createClient } from "@/lib/supabase/server";
import type {
  ClubMembershipSummary,
  CoachInviteCodeSummary,
  CoachRelationship,
  ProfileSummary,
  SportTypeSummary,
  StudentRelationship,
} from "../types";

/** Raw row shapes returned by Supabase for the community queries. */
export type SportTypeRow = { id: number; name: string | null };

export type CoachRelationshipRow = {
  coach: ProfileSummary | ProfileSummary[];
  sport_types: unknown;
};

export type StudentRelationshipRow = {
  student: ProfileSummary | ProfileSummary[];
  sport_types: unknown;
};

export type ClubMembershipRow = {
  club_id: string;
  is_primary: boolean;
  clubs:
    | { id: string; name: string; invite_code: string }
    | Array<{ id: string; name: string; invite_code: string }>
    | null;
};

export type InviteCodeRow = {
  code: string;
  is_active: boolean;
  expires_at: string | null;
  sport_types:
    | { id: number; name: string }
    | Array<{ id: number; name: string }>
    | null;
};

export const normalizeSportTypes = (
  rows: SportTypeRow[] | null,
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

export const normalizeCoaches = (
  items: CoachRelationshipRow[] | null,
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
        league_tier: item.coach.league_tier ?? null,
        avatar_url: item.coach.avatar_url ?? null,
      },
      sport_type:
        typeof item.sport_types === "object" && item.sport_types !== null
          ? (item.sport_types as SportTypeSummary)
          : null,
    }));
};

export const normalizeStudents = (
  items: StudentRelationshipRow[] | null,
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
        league_tier: item.student.league_tier ?? null,
        avatar_url: item.student.avatar_url ?? null,
      },
      sport_type:
        typeof item.sport_types === "object" && item.sport_types !== null
          ? (item.sport_types as SportTypeSummary)
          : null,
    }));
};

export const buildWeeklyLeaderboard = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  userIds?: string[],
): Promise<ProfileSummary[]> => {
  const { data: leaderboard, error } = await supabase.rpc(
    "get_weekly_leaderboard",
    {
      p_user_ids: userIds ?? null,
      p_limit: 50,
    },
  );

  const buildTotalXpLeaderboard = async (): Promise<ProfileSummary[]> => {
    let query = supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, level, league_tier, xp")
      .order("xp", { ascending: false })
      .limit(50);

    if (userIds && userIds.length > 0) {
      query = query.in("id", userIds);
    }

    const { data: totalXpRows } = await query;

    return (totalXpRows ?? []).map(
      (row: {
        id: string;
        email: string | null;
        full_name: string | null;
        avatar_url: string | null;
        level: number | null;
        league_tier: string | null;
        xp: number | null;
      }) => ({
        id: row.id,
        email: row.email ?? null,
        full_name: row.full_name ?? null,
        avatar_url: row.avatar_url ?? null,
        level: row.level ?? 1,
        league_tier: row.league_tier ?? null,
        xp: row.xp ?? 0,
      }),
    );
  };

  if (error || !leaderboard) {
    return buildTotalXpLeaderboard();
  }

  const mappedWeeklyLeaderboard: ProfileSummary[] = leaderboard.map(
    (row: {
      id: string;
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
      level: number | null;
      league_tier: string | null;
      weekly_xp: number | null;
    }) => ({
      id: row.id,
      email: row.email ?? null,
      full_name: row.full_name ?? null,
      avatar_url: row.avatar_url ?? null,
      level: row.level ?? 1,
      league_tier: row.league_tier ?? null,
      xp: row.weekly_xp ?? 0,
      weekly_xp: row.weekly_xp ?? 0,
    }),
  );

  const hasAnyWeeklyXp = mappedWeeklyLeaderboard.some(
    (row) => (row.weekly_xp ?? 0) > 0,
  );

  if (!hasAnyWeeklyXp) {
    return buildTotalXpLeaderboard();
  }

  return mappedWeeklyLeaderboard;
};

export const normalizeClubMemberships = (
  rows: ClubMembershipRow[] | null,
): ClubMembershipSummary[] => {
  if (!rows) {
    return [];
  }

  return rows
    .map((row) => {
      const club = Array.isArray(row.clubs) ? row.clubs[0] : row.clubs;

      return {
        club_id: club?.id ?? row.club_id,
        club_name: club?.name ?? "Club",
        club_invite_code: club?.invite_code ?? "",
        is_primary: row.is_primary,
      };
    })
    .filter((row) => Boolean(row.club_id));
};

export const normalizeInviteCodes = (
  rows: InviteCodeRow[] | null,
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
