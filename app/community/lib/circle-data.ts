import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { fetchDiscoverProfiles } from "./discover";
import type { ProfileSummary } from "../types";

export type CircleData = {
  user: User;
  followingUserIds: string[];
  followingProfiles: ProfileSummary[];
  discoverProfiles: ProfileSummary[];
  discoverPage: number;
  discoverHasNextPage: boolean;
};

export async function getCircleData(
  searchTerm?: string,
  discoverPageInput = 1,
): Promise<CircleData> {
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

  const { data: rawFollowingRows } = await supabase
    .from("social_graph")
    .select("following_id")
    .eq("follower_id", user.id);

  const followingIds = (
    (rawFollowingRows as Array<{ following_id: string | null }> | null) ?? []
  )
    .map((row) => row.following_id)
    .filter((id): id is string => Boolean(id));

  const { data: rawFollowingProfilesData } = followingIds.length
    ? await supabase
        .from("profiles")
        .select("id, email, full_name, xp, level, league_tier, avatar_url")
        .in("id", followingIds)
    : { data: [] as ProfileSummary[] };

  const discoverProfiles = (
    await fetchDiscoverProfiles(supabase, {
      currentUserId: user.id,
      searchTerm: searchTerm?.trim(),
      range: {
        from: discoverFrom,
        to: discoverTo,
      },
    })
  ).profiles;
  const discoverHasNextPage = discoverProfiles.length > discoverPageSize;

  return {
    user,
    followingUserIds: followingIds,
    followingProfiles: rawFollowingProfilesData ?? [],
    discoverProfiles: discoverProfiles.slice(0, discoverPageSize),
    discoverPage,
    discoverHasNextPage,
  };
}
