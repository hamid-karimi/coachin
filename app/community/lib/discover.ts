import type { ProfileSummary } from "../types";

type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export const DISCOVER_DEFAULT_LIMIT = 8;
export const DISCOVER_MAX_LIMIT = 20;

export type DiscoverProfilesInput = {
  currentUserId: string;
  searchTerm?: string;
  limit?: number;
  range?: {
    from: number;
    to: number;
  };
};

export function sanitizeDiscoverSearchTerm(value: string) {
  return value.replace(/[%(),;'"\\]/g, " ").trim();
}

export function normalizeDiscoverLimit(
  rawLimit: number,
  defaultLimit = DISCOVER_DEFAULT_LIMIT,
  maxLimit = DISCOVER_MAX_LIMIT,
) {
  if (Number.isNaN(rawLimit)) {
    return defaultLimit;
  }

  return Math.min(Math.max(rawLimit, 1), maxLimit);
}

export async function fetchDiscoverProfiles(
  supabase: SupabaseServerClient,
  input: DiscoverProfilesInput,
) {
  const { currentUserId, searchTerm, limit, range } = input;
  const safeSearchTerm = searchTerm
    ? sanitizeDiscoverSearchTerm(searchTerm)
    : "";

  let discoverQuery = supabase
    .from("profiles")
    .select("id, email, full_name, xp, level, avatar_url")
    .neq("id", currentUserId)
    .order("xp", { ascending: false });

  if (typeof limit === "number") {
    discoverQuery = discoverQuery.limit(limit);
  }

  if (range) {
    discoverQuery = discoverQuery.range(range.from, range.to);
  }

  if (safeSearchTerm) {
    discoverQuery = discoverQuery.or(
      `full_name.ilike.%${safeSearchTerm}%,email.ilike.%${safeSearchTerm}%`,
    );
  }

  const { data, error } = await discoverQuery;

  return {
    profiles: (data as ProfileSummary[] | null) ?? [],
    error,
  };
}

export async function fetchFollowingIdsForTargets(
  supabase: SupabaseServerClient,
  currentUserId: string,
  targetUserIds: string[],
) {
  if (targetUserIds.length === 0) {
    return [];
  }

  const { data: followingRows } = await supabase
    .from("social_graph")
    .select("following_id")
    .eq("follower_id", currentUserId)
    .in("following_id", targetUserIds);

  return (followingRows ?? [])
    .map((row) => row.following_id)
    .filter((id): id is string => Boolean(id));
}
