import type { createClient } from "@/lib/supabase/server";
import { GOAL_TYPE_META, goalProgress, type GoalType } from "@/lib/goals";

/**
 * After new data lands (e.g. a measurement), settle any active
 * measurement-sourced goals that just crossed their target. Awards +200 XP
 * per goal through the idempotent achieve_goal RPC. Returns the labels of
 * newly achieved goals so callers can celebrate in the toast/confetti.
 */
export async function checkGoalAchievements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  latest: { weight_kg: number | null; body_fat_pct: number | null },
): Promise<string[]> {
  const { data: goals } = await supabase
    .from("goals")
    .select("id, goal_type, target_value, start_value")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("goal_type", ["weight", "body_fat_pct"]);

  const achievedLabels: string[] = [];

  for (const goal of goals ?? []) {
    const current =
      goal.goal_type === "weight" ? latest.weight_kg : latest.body_fat_pct;
    const progress = goalProgress(
      goal.start_value,
      goal.target_value,
      current,
    );
    if (!progress?.achieved) continue;

    const { data } = await supabase.rpc("achieve_goal", {
      p_goal_id: goal.id,
    });
    if (data && data.success && data.status === "achieved") {
      const meta = GOAL_TYPE_META[goal.goal_type as GoalType];
      achievedLabels.push(`${meta.label} ${goal.target_value}${meta.unit}`);
    }
  }

  return achievedLabels;
}
