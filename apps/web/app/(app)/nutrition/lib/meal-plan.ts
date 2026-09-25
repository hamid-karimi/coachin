import type { components } from "@/lib/api/schema";
import { WEEK_DAYS, type WeekDay } from "@/lib/week-days";

export type MealPlanPage = components["schemas"]["MealPlanPageBody"];
export type MealPlan = components["schemas"]["MealPlanBody"];
export type PlannedMeal = components["schemas"]["PlannedMealBody"];
export type PlanIntakeBody = components["schemas"]["MealPlanIntakeBody"];
type Goal = PlanIntakeBody["goal"];

export const PLAN_GOALS: { value: Goal; label: string }[] = [
  { value: "lose", label: "Lose fat" },
  { value: "maintain", label: "Maintain" },
  { value: "gain", label: "Gain muscle" },
  { value: "recomp", label: "Recomp" },
];

export const DIETS = ["omnivore", "vegetarian", "vegan", "pescatarian", "halal", "keto"] as const;

export const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export interface PlanDraft {
  goal: Goal;
  diet: string;
  mealsPerDay: 3 | 4;
  allergies: string;
  dislikes: string;
}

export type PlanDraftAction = { [K in keyof PlanDraft]: { field: K; value: PlanDraft[K] } }[keyof PlanDraft];

export const INITIAL_PLAN_DRAFT: PlanDraft = {
  goal: "maintain",
  diet: "omnivore",
  mealsPerDay: 3,
  allergies: "",
  dislikes: "",
};

export function planDraftReducer(draft: PlanDraft, action: PlanDraftAction): PlanDraft {
  return { ...draft, [action.field]: action.value };
}

/** "peanuts, shellfish ,," → ["peanuts", "shellfish"] (at most 20). */
export function parseList(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function planIntakeBody(draft: PlanDraft): PlanIntakeBody {
  return {
    goal: draft.goal,
    diet: draft.diet,
    mealsPerDay: draft.mealsPerDay,
    allergies: parseList(draft.allergies),
    dislikes: parseList(draft.dislikes),
  };
}

/** The week menu, Monday first; days without meals are left out. */
export function planDays(meals: PlannedMeal[]): { day: WeekDay; meals: PlannedMeal[] }[] {
  return WEEK_DAYS.map((day) => ({ day, meals: meals.filter((meal) => meal.dayOfWeek === day.id) })).filter(
    (entry) => entry.meals.length > 0,
  );
}

/** "20g protein · 70g carbs · 8g fat · 12g sugar" */
export function plannedMealLine(meal: PlannedMeal): string {
  const n = meal.nutrients;
  return `${Math.round(n.proteinG)}g protein · ${Math.round(n.carbsG)}g carbs · ${Math.round(n.fatG)}g fat · ${Math.round(n.sugarG)}g sugar`;
}

/** YouTube search for the meal's how-to video, if any. */
export function mealVideoUrl(meal: PlannedMeal): string | null {
  return meal.videoQuery ? `https://www.youtube.com/results?search_query=${encodeURIComponent(meal.videoQuery)}` : null;
}

type MealAdherence = components["schemas"]["MealAdherenceBody"];

/** The calendar's adherence line: "2/3 meals logged · 85% of plan kcal". */
export function adherenceText(adherence: MealAdherence): string {
  if (adherence.slotsLogged === 0) return "No meals logged";
  const slots = `${adherence.slotsLogged}/${adherence.slotsPlanned} meals logged`;
  if (adherence.kcalRatio == null) return slots;
  return `${slots} · ${Math.round(adherence.kcalRatio * 100)}% of plan kcal`;
}

/** "2 meals planned · 1,150 kcal" */
export function plannedMealsText(count: number, kcal: number): string {
  return `${count} ${count === 1 ? "meal" : "meals"} planned · ${Math.round(kcal).toLocaleString("en-US")} kcal`;
}

/** Today card footer: "1,850 kcal planned · target 2,100". */
export function todaysMealsText(meals: { kcal: number }[], kcalTarget: number): string {
  const total = meals.reduce((sum, meal) => sum + meal.kcal, 0);
  const planned = `${Math.round(total).toLocaleString("en-US")} kcal planned`;
  return kcalTarget > 0 ? `${planned} · target ${Math.round(kcalTarget).toLocaleString("en-US")}` : planned;
}
