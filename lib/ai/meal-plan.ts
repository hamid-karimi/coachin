/**
 * AI weekly meal-plan generation via Gemini. Server-only. Targets are computed
 * deterministically in lib/nutrition-targets.ts and passed in — the model only
 * designs meals that hit them. The user reviews the plan before it drives goals.
 */
import { Type } from "@google/genai";
import { generateJsonText } from "./text-json";
import type { NutritionGoal, NutritionTargets } from "@/lib/nutrition-targets";

export interface MealPlanIntake {
  goal: NutritionGoal;
  /** omnivore | vegetarian | vegan | pescatarian | halal | keto | … */
  diet: string;
  allergies: string[];
  dislikes: string[];
  /** Meals per day (3 = B/L/D, 4 adds a snack). */
  meals_per_day: number;
  targets: NutritionTargets;
  /** Consented body-photo analysis summary, when available. */
  body_analysis?: string | null;
}

export interface GeneratedMealItem {
  day_of_week: number; // 0=Sun … 6=Sat
  meal_type: string; // breakfast | lunch | dinner | snack
  title: string;
  ingredients: { name: string; qty?: string }[];
  recipe: string;
  video_query: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
}

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);
const num = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));

export async function generateMealPlan(
  intake: MealPlanIntake,
): Promise<GeneratedMealItem[] | { error: string }> {
  const { targets } = intake;
  const prompt = [
    `Design a 7-day meal plan (day_of_week 0=Sunday … 6=Saturday) with ${intake.meals_per_day} meals per day.`,
    `Each day should total roughly ${targets.kcal} kcal, ${targets.protein_g}g protein, ${targets.carbs_g}g carbs, ${targets.fat_g}g fat.`,
    `Goal: ${intake.goal}. Diet: ${intake.diet}.`,
    intake.allergies.length
      ? `STRICTLY avoid these allergens: ${intake.allergies.join(", ")}.`
      : null,
    intake.dislikes.length
      ? `Avoid where possible: ${intake.dislikes.join(", ")}.`
      : null,
    intake.body_analysis
      ? `Athlete context (consented): ${intake.body_analysis}`
      : null,
    `For every meal provide: day_of_week, meal_type (breakfast/lunch/dinner/snack), a short title, an ingredient list with quantities, 1-3 concise recipe steps, a YouTube search query for a how-to video, and the meal's macros (protein/carbs/fat/sugar/fiber in grams, sodium in mg) and kcal.`,
    `Vary meals across the week. Keep ingredients common and affordable.`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateJsonText({
    prompt,
    schema: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day_of_week: { type: Type.NUMBER },
              meal_type: { type: Type.STRING },
              title: { type: Type.STRING },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    qty: { type: Type.STRING },
                  },
                  required: ["name"],
                },
              },
              recipe: { type: Type.STRING },
              video_query: { type: Type.STRING },
              kcal: { type: Type.NUMBER },
              protein_g: { type: Type.NUMBER },
              carbs_g: { type: Type.NUMBER },
              fat_g: { type: Type.NUMBER },
              sugar_g: { type: Type.NUMBER },
              fiber_g: { type: Type.NUMBER },
              sodium_mg: { type: Type.NUMBER },
            },
            required: ["day_of_week", "meal_type", "title", "kcal"],
          },
        },
      },
      required: ["items"],
    },
  });

  if (!result)
    return { error: "AI is temporarily unavailable — try again later" };

  try {
    const parsed = JSON.parse(result.text) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];

    const items = parsed.items
      .map((entry): GeneratedMealItem | null => {
        const item = entry as Record<string, unknown>;
        const day = Math.round(Number(item.day_of_week));
        const mealType = String(item.meal_type ?? "").toLowerCase();
        const title = String(item.title ?? "").trim().slice(0, 120);
        if (!Number.isInteger(day) || day < 0 || day > 6) return null;
        if (!MEAL_TYPES.has(mealType) || !title) return null;

        const ingredients = Array.isArray(item.ingredients)
          ? (item.ingredients as Record<string, unknown>[])
              .map((ing) => ({
                name: String(ing?.name ?? "").trim().slice(0, 80),
                qty: ing?.qty ? String(ing.qty).slice(0, 40) : undefined,
              }))
              .filter((ing) => ing.name)
              .slice(0, 20)
          : [];

        return {
          day_of_week: day,
          meal_type: mealType,
          title,
          ingredients,
          recipe: String(item.recipe ?? "").slice(0, 600),
          video_query: String(item.video_query ?? title).slice(0, 100),
          kcal: Math.min(num(item.kcal), 5000),
          protein_g: num(item.protein_g),
          carbs_g: num(item.carbs_g),
          fat_g: num(item.fat_g),
          sugar_g: num(item.sugar_g),
          fiber_g: num(item.fiber_g),
          sodium_mg: num(item.sodium_mg),
        };
      })
      .filter((item): item is GeneratedMealItem => item !== null)
      .slice(0, 40);

    return items;
  } catch (error) {
    console.error("Meal-plan parse failed:", error);
    return { error: "AI is temporarily unavailable — try again later" };
  }
}
