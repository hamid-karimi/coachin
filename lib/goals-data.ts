import type { createClient } from "@/lib/supabase/server";
import {
  goalProgress,
  type Goal,
  type GoalProgress,
  type GoalType,
} from "@/lib/goals";

export type GoalWithProgress = Goal & {
  /** Latest known value for the goal's metric; null when not yet tracked. */
  current: number | null;
  progress: GoalProgress | null;
};

export type GoalsData = {
  active: GoalWithProgress[];
  achieved: Goal[];
};

/**
 * Loads goals and resolves each active goal's current value.
 * v1 limitation: only measurement-sourced types (weight, body fat) have live
 * values — calorie types arrive with the nutrition branch, run-km once logs
 * carry distance. Untracked goals render an informational state.
 */
export async function getGoalsWithProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<GoalsData> {
  const [{ data: goals }, { data: latestMeasurement }, { data: profile }] =
    await Promise.all([
      supabase
        .from("goals")
        .select(
          "id, goal_type, target_value, start_value, target_date, status, achieved_at, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("body_measurements")
        .select("weight_kg, body_fat_pct, measured_at")
        .eq("user_id", userId)
        .order("measured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("profiles")
        .select("weight_kg, body_fat_pct")
        .eq("id", userId)
        .single(),
    ]);

  const latestWeight =
    latestMeasurement?.find((row) => row.weight_kg !== null)?.weight_kg ??
    profile?.weight_kg ??
    null;
  const latestBodyFat =
    latestMeasurement?.find((row) => row.body_fat_pct !== null)
      ?.body_fat_pct ??
    profile?.body_fat_pct ??
    null;

  const currentFor = (type: GoalType): number | null => {
    if (type === "weight") return latestWeight;
    if (type === "body_fat_pct") return latestBodyFat;
    return null;
  };

  const all = (goals ?? []) as Goal[];
  const active = all
    .filter((goal) => goal.status === "active")
    .map((goal) => {
      const current = currentFor(goal.goal_type);
      return {
        ...goal,
        current,
        progress: goalProgress(goal.start_value, goal.target_value, current),
      };
    });
  const achieved = all.filter((goal) => goal.status === "achieved").slice(0, 3);

  return { active, achieved };
}
