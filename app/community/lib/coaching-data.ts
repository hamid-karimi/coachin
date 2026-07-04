import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { CoachRelationship } from "../types";
import { normalizeCoaches, type CoachRelationshipRow } from "./normalizers";

export type CoachingData = {
  user: User;
  profileRole: string;
  /**
   * Trainee-side data only. Coach-side data (roster, invite codes, trainee
   * leaderboard) lives in app/coaching/lib/coaching-hub-data.ts.
   */
  coaches: CoachRelationship[];
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

  const { data: rawCoachesData } = await supabase
    .from("coaching_relationships")
    .select(
      "coach:profiles(id, email, xp, level, league_tier, full_name, avatar_url), sport_types(id, name)",
    )
    .eq("student_id", user.id)
    .eq("status", "active");

  return {
    user,
    profileRole,
    coaches: normalizeCoaches(
      (rawCoachesData as CoachRelationshipRow[] | null) ?? null,
    ),
  };
}
