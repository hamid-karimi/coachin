import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type {
  CoachInviteCodeSummary,
  CoachRelationship,
  ProfileSummary,
  SportTypeSummary,
  StudentRelationship,
} from "../types";
import {
  normalizeCoaches,
  normalizeInviteCodes,
  normalizeSportTypes,
  normalizeStudents,
  type CoachRelationshipRow,
  type InviteCodeRow,
  type SportTypeRow,
  type StudentRelationshipRow,
} from "./normalizers";

export type CoachingData = {
  user: User;
  profileRole: string;
  coaches: CoachRelationship[];
  /**
   * Coach-side data (students, sportTypes, inviteCodes, leaderboard) renders
   * on this segment until Phase 3 relocates it to /coaching.
   */
  students: StudentRelationship[];
  coachStudentsLeaderboard: ProfileSummary[];
  sportTypes: SportTypeSummary[];
  coachInviteCodes: CoachInviteCodeSummary[];
};

export async function getCoachingData(): Promise<CoachingData> {
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

  const [{ data: rawCoachesData }, { data: rawStudentsData }] =
    await Promise.all([
      supabase
        .from("coaching_relationships")
        .select(
          "coach:profiles(id, email, xp, level, league_tier, full_name, avatar_url), sport_types(id, name)",
        )
        .eq("student_id", user.id)
        .eq("status", "active"),
      supabase
        .from("coaching_relationships")
        .select(
          "student:profiles(id, email, xp, level, league_tier, full_name, avatar_url), sport_types(id, name)",
        )
        .eq("coach_id", user.id)
        .eq("status", "active"),
    ]);

  const [{ data: rawSportTypesData }, { data: rawCoachInviteCodesData }] =
    await Promise.all([
      supabase
        .from("sport_types")
        .select("id, name")
        .order("name", { ascending: true }),
      supabase
        .from("coach_invite_codes")
        .select("code, is_active, expires_at, sport_types(id, name)")
        .eq("coach_id", user.id)
        .order("updated_at", { ascending: false }),
    ]);

  const normalizedCoaches = normalizeCoaches(
    (rawCoachesData as CoachRelationshipRow[] | null) ?? null,
  );

  const normalizedStudents = normalizeStudents(
    (rawStudentsData as StudentRelationshipRow[] | null) ?? null,
  );

  const coachStudentsLeaderboard = [...normalizedStudents]
    .map((item) => item.student)
    .sort((first, second) => (second.xp ?? 0) - (first.xp ?? 0));

  return {
    user,
    profileRole,
    coaches: normalizedCoaches,
    students: normalizedStudents,
    coachStudentsLeaderboard,
    sportTypes: normalizeSportTypes(
      (rawSportTypesData as SportTypeRow[] | null) ?? null,
    ),
    coachInviteCodes: normalizeInviteCodes(
      (rawCoachInviteCodesData as InviteCodeRow[] | null) ?? null,
    ),
  };
}
