/**
 * Goal metadata + progress math (pure — no IO). Roadmap branch 2.
 *
 * `direction` matters: a weight-loss goal counts DOWN (target < start),
 * a running-volume goal counts UP. Progress is how far current has moved
 * from start toward target, clamped to 0–100.
 */

export type GoalType =
  | "weight"
  | "calorie_intake"
  | "calories_burned"
  | "weekly_run_km"
  | "monthly_run_km"
  | "body_fat_pct";

export type GoalStatus = "active" | "achieved" | "abandoned";

export type Goal = {
  id: string;
  goal_type: GoalType;
  target_value: number;
  start_value: number | null;
  target_date: string | null;
  status: GoalStatus;
  achieved_at: string | null;
  created_at: string;
};

export const GOAL_TYPE_META: Record<
  GoalType,
  {
    label: string;
    unit: string;
    /** Where the current value comes from; 'nutrition'/'activity' land in later branches. */
    source: "measurement" | "nutrition" | "activity";
  }
> = {
  weight: { label: "Weight", unit: "kg", source: "measurement" },
  body_fat_pct: { label: "Body fat", unit: "%", source: "measurement" },
  calorie_intake: {
    label: "Daily calorie intake",
    unit: "kcal",
    source: "nutrition",
  },
  calories_burned: {
    label: "Daily calories burned",
    unit: "kcal",
    source: "nutrition",
  },
  weekly_run_km: { label: "Weekly running", unit: "km", source: "activity" },
  monthly_run_km: { label: "Monthly running", unit: "km", source: "activity" },
};

export type GoalProgress = {
  /** 0–100, movement from start toward target. */
  pct: number;
  direction: "up" | "down";
  achieved: boolean;
};

/**
 * Progress from start → target given the current value.
 * Down-direction goals (target < start, e.g. weight loss) are handled by
 * measuring distance covered from the start value.
 */
export function goalProgress(
  start: number | null,
  target: number,
  current: number | null,
): GoalProgress | null {
  if (current === null || !Number.isFinite(current)) return null;

  const effectiveStart =
    start !== null && Number.isFinite(start) && start !== target
      ? start
      : null;
  const direction: "up" | "down" =
    effectiveStart !== null && target < effectiveStart ? "down" : "up";

  const achieved =
    direction === "down" ? current <= target : current >= target;

  if (effectiveStart === null) {
    // No usable start value: progress is a simple ratio toward the target.
    const pct =
      direction === "down"
        ? achieved
          ? 100
          : Math.round((target / current) * 100)
        : Math.round((current / target) * 100);
    return { pct: Math.max(0, Math.min(100, pct)), direction, achieved };
  }

  const total = Math.abs(target - effectiveStart);
  const covered =
    direction === "down" ? effectiveStart - current : current - effectiveStart;
  const pct = Math.round((covered / total) * 100);
  return { pct: Math.max(0, Math.min(100, pct)), direction, achieved };
}
