import type { createClient } from "@/lib/supabase/server";

export type PlannedMeal = {
  id: string;
  meal_type: string;
  title: string;
  kcal: number;
};

export type ActiveMealPlanByDay = {
  /** Daily calorie target from the plan intake. */
  kcalTarget: number | null;
  /** day_of_week (0=Sun … 6=Sat, same as Date#getDay) → that day's meals. */
  byDay: Map<number, PlannedMeal[]>;
};

/**
 * The active AI meal plan's menu grouped by weekday, for surfacing on the
 * dashboard ("Today's meals") and calendar (per-day meals chip). Returns null
 * when no active plan exists. Best-effort: query errors read as "no plan".
 */
export async function getActiveMealPlanByDay(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ActiveMealPlanByDay | null> {
  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, kcal_target")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!plan) return null;

  const { data: items } = await supabase
    .from("meal_plan_items")
    .select("id, day_of_week, meal_type, title, kcal")
    .eq("plan_id", plan.id)
    .order("day_of_week")
    .order("sort");

  const byDay = new Map<number, PlannedMeal[]>();
  for (const item of (items ?? []) as {
    id: string;
    day_of_week: number;
    meal_type: string;
    title: string;
    kcal: number | null;
  }[]) {
    const meals = byDay.get(item.day_of_week) ?? [];
    meals.push({
      id: item.id,
      meal_type: item.meal_type,
      title: item.title,
      kcal: Number(item.kcal ?? 0),
    });
    byDay.set(item.day_of_week, meals);
  }

  return {
    kcalTarget: plan.kcal_target !== null ? Number(plan.kcal_target) : null,
    byDay,
  };
}
