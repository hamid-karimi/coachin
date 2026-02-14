import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DISCOVER_DEFAULT_LIMIT,
  fetchDiscoverProfiles,
  fetchFollowingIdsForTargets,
  normalizeDiscoverLimit,
  sanitizeDiscoverSearchTerm,
} from "../../lib/discover";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = sanitizeDiscoverSearchTerm(rawQuery);

  if (!query) {
    return NextResponse.json({
      profiles: [],
      followingUserIds: [],
    });
  }

  const rawLimit = Number(
    searchParams.get("limit") ?? String(DISCOVER_DEFAULT_LIMIT),
  );
  const limit = normalizeDiscoverLimit(rawLimit);

  const { profiles, error } = await fetchDiscoverProfiles(supabase, {
    currentUserId: user.id,
    searchTerm: query,
    limit,
  });

  if (error) {
    return NextResponse.json(
      { error: `Discover query failed: ${error.message}` },
      { status: 400 },
    );
  }

  const profileIds = profiles.map((profile) => profile.id);
  const followingUserIds = await fetchFollowingIdsForTargets(
    supabase,
    user.id,
    profileIds,
  );

  return NextResponse.json({
    profiles,
    followingUserIds,
  });
}
