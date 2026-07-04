import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { ClubMembershipSummary } from "../types";
import {
  normalizeClubMemberships,
  type ClubMembershipRow,
} from "./normalizers";

export type ClubsData = {
  user: User;
  clubMemberships: ClubMembershipSummary[];
};

export async function getClubsData(): Promise<ClubsData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: rawClubMembershipsData } = await supabase
    .from("club_members")
    .select("club_id, is_primary, clubs(id, name, invite_code)")
    .eq("user_id", user.id);

  return {
    user,
    clubMemberships: normalizeClubMemberships(
      (rawClubMembershipsData as ClubMembershipRow[] | null) ?? null,
    ),
  };
}
