import { createClient } from "@/lib/supabase/server";

export type GroupMember = {
  user_id: string;
  name: string;
  initials: string;
  avatar_url: string | null;
  weekly_xp: number;
  trained_today: boolean;
};

export type GroupDay = { date: string; all_trained: boolean };

export type TrainingGroup = {
  id: string;
  name: string;
  invite_code: string;
  streak_count: number;
  best_streak: number;
  members: GroupMember[];
  recent_days: GroupDay[];
};

type MemberRow = {
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Groups loader: evaluates pending days lazily (idempotent RPC — the roadmap
 * mechanic settles past days on view), then assembles members with weekly XP
 * and trained-today flags.
 */
export async function getGroupsData(): Promise<{ groups: TrainingGroup[] }> {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id");
  const groupIds = (memberships ?? []).map((row) => row.group_id as string);
  if (groupIds.length === 0) return { groups: [] };

  // Settle any un-evaluated past days (streak/XP) before reading.
  await Promise.all(
    groupIds.map((groupId) =>
      supabase.rpc("evaluate_group_days", { p_group_id: groupId }),
    ),
  );

  const { data: groupRows } = await supabase
    .from("training_groups")
    .select("id, name, invite_code, streak_count, best_streak")
    .in("id", groupIds)
    .order("created_at");

  const groups: TrainingGroup[] = [];
  for (const group of groupRows ?? []) {
    const [{ data: memberRows }, { data: dayRows }, { data: trainedToday }] =
      await Promise.all([
        supabase
          .from("group_members")
          .select("user_id, profiles(full_name, email, avatar_url)")
          .eq("group_id", group.id),
        supabase
          .from("group_days")
          .select("date, all_trained")
          .eq("group_id", group.id)
          .order("date", { ascending: false })
          .limit(7),
        supabase.rpc("group_trained_today", { p_group_id: group.id }),
      ]);

    const memberIds = (memberRows ?? []).map((row) => row.user_id as string);
    const { data: weekly } = await supabase.rpc("get_weekly_leaderboard", {
      p_user_ids: memberIds,
      p_limit: memberIds.length,
    });
    const weeklyByUser = new Map<string, number>(
      ((weekly ?? []) as { user_id: string; weekly_xp: number }[]).map(
        (row) => [row.user_id, Number(row.weekly_xp) || 0],
      ),
    );
    const trainedSet = new Set<string>((trainedToday ?? []) as string[]);

    const members: GroupMember[] = ((memberRows ?? []) as unknown as MemberRow[])
      .map((row) => {
        const name =
          row.profiles?.full_name ||
          row.profiles?.email?.split("@")[0] ||
          "Member";
        return {
          user_id: row.user_id,
          name,
          initials: name[0]?.toUpperCase() ?? "?",
          avatar_url: row.profiles?.avatar_url ?? null,
          weekly_xp: weeklyByUser.get(row.user_id) ?? 0,
          trained_today: trainedSet.has(row.user_id),
        };
      })
      .sort((a, b) => b.weekly_xp - a.weekly_xp);

    groups.push({
      id: group.id as string,
      name: group.name as string,
      invite_code: group.invite_code as string,
      streak_count: Number(group.streak_count) || 0,
      best_streak: Number(group.best_streak) || 0,
      members,
      recent_days: ((dayRows ?? []) as GroupDay[]).slice().reverse(),
    });
  }

  return { groups };
}
