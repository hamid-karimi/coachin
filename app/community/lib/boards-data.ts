import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { ProfileSummary } from "../types";
import {
  buildWeeklyLeaderboard,
  normalizeClubMemberships,
  type ClubMembershipRow,
} from "./normalizers";

export type ActiveBoard = "global" | "club" | "circle";

export type BoardsData = {
  user: User;
  primaryClubName: string | null;
  followingUserIds: string[];
  leaderboard: ProfileSummary[];
};

export async function getBoardsData(
  activeBoard: ActiveBoard,
): Promise<BoardsData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Clubs power the "My Club" board; the social graph powers "My Circle".
  const [{ data: rawClubMembershipsData }, { data: rawFollowingRows }] =
    await Promise.all([
      supabase
        .from("club_members")
        .select("club_id, is_primary, clubs(id, name, invite_code)")
        .eq("user_id", user.id),
      supabase
        .from("social_graph")
        .select("following_id")
        .eq("follower_id", user.id),
    ]);

  const normalizedClubMemberships = normalizeClubMemberships(
    (rawClubMembershipsData as ClubMembershipRow[] | null) ?? null,
  );

  const primaryClubMembership =
    normalizedClubMemberships.find((membership) => membership.is_primary) ??
    normalizedClubMemberships[0] ??
    null;

  const followingIds = (
    (rawFollowingRows as Array<{ following_id: string | null }> | null) ?? []
  )
    .map((row) => row.following_id)
    .filter((id): id is string => Boolean(id));

  let leaderboard: ProfileSummary[] = [];

  if (activeBoard === "global") {
    leaderboard = await buildWeeklyLeaderboard(supabase);
  }

  if (activeBoard === "circle") {
    leaderboard = followingIds.length
      ? await buildWeeklyLeaderboard(supabase, followingIds)
      : [];
  }

  if (activeBoard === "club" && primaryClubMembership?.club_id) {
    const { data: clubMemberRows } = await supabase
      .from("club_members")
      .select("user_id")
      .eq("club_id", primaryClubMembership.club_id);

    const clubUserIds = (clubMemberRows ?? [])
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id));

    if (clubUserIds.length > 0) {
      leaderboard = await buildWeeklyLeaderboard(supabase, clubUserIds);
    }
  }

  return {
    user,
    primaryClubName: primaryClubMembership?.club_name ?? null,
    followingUserIds: followingIds,
    leaderboard,
  };
}
