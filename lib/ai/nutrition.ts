/**
 * Meal-photo calorie estimation via Gemini vision (roadmap branch 5).
 * Server-only. The AI proposes; the user always reviews and edits before
 * anything is saved (roadmap anti-pattern: never auto-save AI estimates).
 */
import { Type } from "@google/genai";
import { generateJsonText } from "./text-json";

export type MealEstimateItem = {
  name: string;
  est_quantity_g: number;
  est_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
};

export async function estimateMealFromPhoto(
  base64: string,
  mimeType: string,
): Promise<MealEstimateItem[] | { error: string }> {
  const result = await generateJsonText({
    prompt:
      "Identify the food items in this meal photo. For each item estimate the portion in grams and, for THAT portion (not per 100g): calories, protein, carbs, fat, sugar, fiber (all in grams) and sodium (in mg). If it is not food, return an empty items array.",
    images: [{ base64, mimeType }],
    schema: {
      type: Type.OBJECT,
      properties: {
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              est_quantity_g: { type: Type.NUMBER },
              est_kcal: { type: Type.NUMBER },
              protein_g: { type: Type.NUMBER },
              carbs_g: { type: Type.NUMBER },
              fat_g: { type: Type.NUMBER },
              sugar_g: { type: Type.NUMBER },
              fiber_g: { type: Type.NUMBER },
              sodium_mg: { type: Type.NUMBER },
            },
            required: ["name", "est_quantity_g", "est_kcal"],
          },
        },
      },
      required: ["items"],
    },
  });

  if (!result) {
    return {
      error: "AI estimation is temporarily unavailable — try again later",
    };
  }

  try {
    const parsed = JSON.parse(result.text) as { items?: unknown };
    if (!Array.isArray(parsed.items)) return [];
    return parsed.items
      .slice(0, 10)
      .map((entry) => {
        const item = entry as Record<string, unknown>;
        const kcal = Number(item.est_kcal);
        const qty = Number(item.est_quantity_g);
        return {
          name: String(item.name ?? "Food item").slice(0, 100),
          est_quantity_g:
            Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 100,
          est_kcal:
            Number.isFinite(kcal) && kcal >= 0
              ? Math.min(Math.round(kcal), 3000)
              : 0,
          protein_g: Math.max(0, Math.round(Number(item.protein_g) || 0)),
          carbs_g: Math.max(0, Math.round(Number(item.carbs_g) || 0)),
          fat_g: Math.max(0, Math.round(Number(item.fat_g) || 0)),
          sugar_g: Math.max(0, Math.round(Number(item.sugar_g) || 0)),
          fiber_g: Math.max(0, Math.round(Number(item.fiber_g) || 0)),
          sodium_mg: Math.max(0, Math.round(Number(item.sodium_mg) || 0)),
        };
      })
      .filter((item) => item.est_kcal > 0);
  } catch (error) {
    console.error("Meal estimation parse failed:", error);
    return {
      error: "AI estimation is temporarily unavailable — try again later",
    };
  }
}
