import type { createClient } from "@/lib/supabase/server";
import type {
  CoachInviteCodeSummary,
  ProfileSummary,
  SportTypeSummary,
  StudentRelationship,
} from "@/app/community/types";
import {
  buildWeeklyLeaderboard,
  normalizeInviteCodes,
  normalizeSportTypes,
  normalizeStudents,
  type InviteCodeRow,
  type SportTypeRow,
  type StudentRelationshipRow,
} from "@/app/community/lib/normalizers";

export type CoachingHubData = {
  /** Active trainee relationships for the signed-in coach. */
  students: StudentRelationship[];
  sportTypes: SportTypeSummary[];
  inviteCodes: CoachInviteCodeSummary[];
  /** Trainees ranked by XP earned this week (get_weekly_leaderboard RPC). */
  weeklyLeaderboard: ProfileSummary[];
  /** userId → weekly XP, when the weekly RPC returned weekly numbers. */
  weeklyXpByUserId: Map<string, number>;
};

/**
 * Coach-hub data loader. The page owns the auth/role guard; this only fetches.
 * Query shapes are copied from the community loaders (see per-query notes).
 */
export async function getCoachingHubData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CoachingHubData> {
  const [
    { data: rawStudentsData },
    { data: rawSportTypesData },
    { data: rawInviteCodesData },
  ] = await Promise.all([
    // Trainee relationships — copied from app/community/lib/coaching-data.ts
    supabase
      .from("coaching_relationships")
      .select(
        "student:profiles(id, email, xp, level, league_tier, full_name, avatar_url), sport_types(id, name)",
      )
      .eq("coach_id", userId)
      .eq("status", "active"),
    // Sport types — copied from app/community/lib/coaching-data.ts
    supabase
      .from("sport_types")
      .select("id, name")
      .order("name", { ascending: true }),
    // Invite codes — copied from app/community/lib/coaching-data.ts
    supabase
      .from("coach_invite_codes")
      .select("code, is_active, expires_at, sport_types(id, name)")
      .eq("coach_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  const students = normalizeStudents(
    (rawStudentsData as StudentRelationshipRow[] | null) ?? null,
  );

  const traineeIds = students.map((relationship) => relationship.student.id);

  // Weekly XP only via the get_weekly_leaderboard RPC (xp_transactions is
  // RLS-blocked for other users). Skip entirely with zero trainees so the
  // total-XP fallback inside buildWeeklyLeaderboard can never widen to
  // everyone on the platform.
  const weeklyLeaderboard =
    traineeIds.length > 0
      ? await buildWeeklyLeaderboard(supabase, traineeIds)
      : [];

  const weeklyXpByUserId = new Map<string, number>(
    weeklyLeaderboard
      .filter((row) => typeof row.weekly_xp === "number")
      .map((row) => [row.id, row.weekly_xp as number]),
  );

  return {
    students,
    sportTypes: normalizeSportTypes(
      (rawSportTypesData as SportTypeRow[] | null) ?? null,
    ),
    inviteCodes: normalizeInviteCodes(
      (rawInviteCodesData as InviteCodeRow[] | null) ?? null,
    ),
    weeklyLeaderboard,
    weeklyXpByUserId,
  };
}
