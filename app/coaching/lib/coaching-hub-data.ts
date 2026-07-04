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

export type TraineeAdherence = {
  /** Distinct day_of_week values (0=Sun..6=Sat) the trainee has scheduled. */
  scheduledDays: number[];
  /** Distinct YYYY-MM-DD dates with a completed log inside the week window. */
  loggedDates: string[];
  /** Count of distinct completed log dates within the week window. */
  doneCount: number;
  /** Count of distinct scheduled days per week. */
  scheduledCount: number;
};

export type CoachingHubData = {
  /** Active trainee relationships for the signed-in coach. */
  students: StudentRelationship[];
  sportTypes: SportTypeSummary[];
  inviteCodes: CoachInviteCodeSummary[];
  /** Trainees ranked by XP earned this week (get_weekly_leaderboard RPC). */
  weeklyLeaderboard: ProfileSummary[];
  /** userId → weekly XP, when the weekly RPC returned weekly numbers. */
  weeklyXpByUserId: Map<string, number>;
  /** userId → this week's schedule adherence (logs + schedules). */
  adherenceByUserId: Map<string, TraineeAdherence>;
  /** Monday of the current week, YYYY-MM-DD (local time). */
  weekStart: string;
};

type TraineeLogRow = {
  user_id: string;
  date: string;
  status: string;
};

type TraineeScheduleRow = {
  user_id: string;
  day_of_week: number;
};

/** Local-date YYYY-MM-DD formatting, copied from app/dashboard/page.tsx. */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

  // Current week window, Monday → Sunday, in local time (same local-date
  // convention as app/dashboard/page.tsx — no UTC shifting).
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7; // getDay(): 0=Sun..6=Sat
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekStart = formatLocalDate(monday);
  const weekEnd = formatLocalDate(sunday);

  // This week's logs + schedules for all trainees. The logs SELECT relies on
  // the coach-read policy in 20260704120000_logs_policies_coach_read.sql;
  // until that migration is applied, RLS silently returns an empty array
  // (not an error) and the adherence UI shows zero completed sessions.
  const [{ data: rawLogsData }, { data: rawSchedulesData }] =
    traineeIds.length > 0
      ? await Promise.all([
          supabase
            .from("logs")
            .select("user_id, date, status")
            .in("user_id", traineeIds)
            .gte("date", weekStart),
          // Readable per 20260214103000_schedules_coach_student_policies.sql.
          supabase
            .from("schedules")
            .select("user_id, day_of_week")
            .in("user_id", traineeIds),
        ])
      : [{ data: null }, { data: null }];

  const logRows = (rawLogsData as TraineeLogRow[] | null) ?? [];
  const scheduleRows = (rawSchedulesData as TraineeScheduleRow[] | null) ?? [];

  const adherenceByUserId = new Map<string, TraineeAdherence>();

  for (const traineeId of traineeIds) {
    const scheduledDays = Array.from(
      new Set(
        scheduleRows
          .filter((row) => row.user_id === traineeId)
          .map((row) => row.day_of_week),
      ),
    );
    const loggedDates = Array.from(
      new Set(
        logRows
          .filter(
            (row) =>
              row.user_id === traineeId &&
              row.status === "completed" &&
              row.date >= weekStart &&
              row.date <= weekEnd,
          )
          .map((row) => row.date),
      ),
    );

    adherenceByUserId.set(traineeId, {
      scheduledDays,
      loggedDates,
      doneCount: loggedDates.length,
      scheduledCount: scheduledDays.length,
    });
  }

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
    adherenceByUserId,
    weekStart,
  };
}
