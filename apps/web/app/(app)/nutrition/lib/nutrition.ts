import type { components } from "@/lib/api/schema";

export type NutritionDay = components["schemas"]["NutritionDayBody"];
export type Meal = components["schemas"]["MealBody"];
export type Nutrients = components["schemas"]["NutrientsBody"];
export type Trend = components["schemas"]["TrendBody"];
export type MealType = Meal["mealType"];

export const MEAL_TYPES: { value: MealType; label: string; groupLabel: string }[] = [
  { value: "breakfast", label: "Breakfast", groupLabel: "Breakfast" },
  { value: "lunch", label: "Lunch", groupLabel: "Lunch" },
  { value: "dinner", label: "Dinner", groupLabel: "Dinner" },
  { value: "snack", label: "Snack", groupLabel: "Snacks" },
];

export type MealGroup = { type: MealType; label: string; meals: Meal[]; kcal: number };

/** Meals grouped by type in day order; empty types are left out. */
export function mealGroups(meals: Meal[]): MealGroup[] {
  return MEAL_TYPES.map(({ value, groupLabel }) => {
    const typed = meals.filter((meal) => meal.mealType === value);
    return {
      type: value,
      label: groupLabel,
      meals: typed,
      kcal: typed.reduce((sum, meal) => sum + meal.nutrients.kcal, 0),
    };
  }).filter((group) => group.meals.length > 0);
}

/** "1,250" — whole kcal with thousands separators. */
export const kcalText = (kcal: number) => Math.round(kcal).toLocaleString("en-US");

/** Percent of the goal eaten, capped at 100; null without a goal. */
export function goalPercent(kcal: number, target: number | null | undefined): number | null {
  return target ? Math.min(100, Math.round((kcal / target) * 100)) : null;
}

/** "30g protein · 40g carbs · 10g fat" */
export function macroLine(n: Nutrients): string {
  return `${Math.round(n.proteinG)}g protein · ${Math.round(n.carbsG)}g carbs · ${Math.round(n.fatG)}g fat`;
}

/** "5g sugar · 3g fiber · 400mg sodium" */
export function microLine(n: Nutrients): string {
  return `${Math.round(n.sugarG)}g sugar · ${Math.round(n.fiberG)}g fiber · ${Math.round(n.sodiumMg)}mg sodium`;
}

/** A meal row's detail: "150g · 30g protein · 0g carbs · 5g fat · 2g sugar" (amount and sugar only when present). */
export function mealDetail(meal: Meal): string {
  const amount = meal.quantityG ? `${Math.round(meal.quantityG)}g · ` : "";
  const sugar = meal.nutrients.sugarG > 0 ? ` · ${Math.round(meal.nutrients.sugarG)}g sugar` : "";
  return `${amount}${macroLine(meal.nutrients)}${sugar}`;
}

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/** Weekday initial of a YYYY-MM-DD date. */
export function weekdayInitial(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return WEEKDAY_INITIALS[new Date(year, month - 1, day).getDay()];
}

export type WeekBar = {
  date: string;
  initial: string;
  kcal: number;
  heightPct: number;
  tone: "empty" | "hit" | "logged";
};

/**
 * The week chart: each day's bar against the goal or the week's peak, with a
 * visible stub for logged days; `goalPct` places the dashed goal line.
 */
export function weekBars(trend: Trend, target: number | null | undefined): { bars: WeekBar[]; goalPct: number | null } {
  const peak = Math.max(target ?? 0, ...trend.series.map((point) => point.totals.kcal), 1);
  const bars = trend.series.map((point): WeekBar => {
    const kcal = point.totals.kcal;
    const tone = kcal === 0 ? "empty" : target && kcal >= target ? "hit" : "logged";
    return {
      date: point.date,
      initial: weekdayInitial(point.date),
      kcal,
      heightPct: Math.max((kcal / peak) * 100, kcal > 0 ? 4 : 2),
      tone,
    };
  });
  return { bars, goalPct: target ? (target / peak) * 100 : null };
}
