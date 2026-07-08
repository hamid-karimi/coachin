/**
 * Hypertrophy plan generation (adaptive-training phase 5). Mirrors
 * generateMarathonPlan and shares its schema: PlanItemInput + validateItems
 * come from lib/ai/marathon.ts — one schema, never forked (plan guard).
 */
import { Type } from "@google/genai";
import { generateJsonText } from "./text-json";
import { anchorsPromptBlock, type PlanAnchor } from "./anchors";
import {
  validateItems,
  type GeneratedPlan,
} from "./marathon";

export type HypertrophyIntake = {
  /** "muscle_gain" | "recomp" */
  goal: string;
  /** "new" | "recreational" | "regular" | "competitive" */
  experience_level: string | null;
  /** "gym" | "home" | "bodyweight" */
  equipment: string;
  days_per_week: number;
  weeks_total: number;
  injuries: string | null;
  /** Daily protein guidance derived from the active calorie goal, if any. */
  calorie_target: number | null;
  /** Combined body-photo analysis summary, when the user consented. */
  body_analysis: string | null;
  // profile snapshot
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_history: string | null;
  /** Fixed weekly commitments (schedules) — prompt constraints only. */
  anchors: PlanAnchor[];
};

const EQUIPMENT_RULES: Record<string, string> = {
  gym: "Full gym available: barbells, dumbbells, machines, cables.",
  home: "Home setup only: dumbbells and resistance bands — no barbell or machines.",
  bodyweight: "No equipment: bodyweight progressions only (push-up/squat/row variations).",
};

export async function generateHypertrophyPlan(
  intake: HypertrophyIntake,
): Promise<GeneratedPlan | { error: string }> {
  const athlete = [
    intake.age ? `age ${intake.age}` : null,
    intake.sex,
    intake.height_cm ? `${intake.height_cm}cm` : null,
    intake.weight_kg ? `${intake.weight_kg}kg` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const prompt = [
    `Create a ${intake.weeks_total}-week ${intake.goal === "recomp" ? "body recomposition" : "muscle building (hypertrophy)"} training plan.`,
    `Athlete: ${athlete || "unknown"}. Experience: ${intake.experience_level ?? "unknown"}. Training history: ${intake.training_history || "unknown"}.`,
    intake.body_analysis
      ? `Body-photo analysis (consented): ${intake.body_analysis}`
      : null,
    `Injuries/limitations: ${intake.injuries || "none reported"}.`,
    EQUIPMENT_RULES[intake.equipment] ?? EQUIPMENT_RULES.bodyweight,
    intake.calorie_target
      ? `The athlete targets ${intake.calorie_target} kcal/day — align protein guidance with it.`
      : null,
    // "" when the athlete has no fixed commitments — filtered out below.
    anchorsPromptBlock(intake.anchors),
    `Rules:`,
    `- Exactly ${intake.days_per_week} strength days per week (day_of_week: 0=Sunday..6=Saturday) using a sensible split for that frequency; remaining days get ONE recovery item.`,
    `- Every item: "title" is a SHORT human-readable session name, max 60 characters (e.g. "Upper body — Day A", "Legs & core"). Put the full exercise list in "description" — NEVER in the title.`,
    `- Every strength item (item_type "strength"): short split-name title, the concrete exercise list with sets x reps in "description" (e.g. "Bench press 4x8 + incline DB press 3x10 + lateral raises 3x15"), details.duration_min, short details.notes on progression (add weight/reps week to week; deload around week ${Math.max(4, intake.weeks_total - 2)}).`,
    `- ONE mobility item per week (item_type "mobility").`,
    `- ONE meal_note item per week with practical protein guidance in details.notes (${intake.weight_kg ? `target ~${Math.round(Number(intake.weight_kg) * 1.8)}g protein/day for ${intake.weight_kg}kg bodyweight` : "about 1.6-2g protein per kg bodyweight"}).`,
    `- Every strength and mobility item gets details.video_query: a concise English YouTube SEARCH query for exercise form, max 80 chars. NEVER produce a youtube.com URL or a video id — only the search words.`,
    intake.experience_level === "new"
      ? `- The athlete is new to training: master form first, start light, higher-rep ranges, simple movements.`
      : null,
    `- Progressive overload across weeks: same split repeats with small load/volume increases, not new random exercises each week.`,
    `- summary: 2-3 sentences describing the plan's approach.`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateJsonText({
    prompt,
    maxTokens: 24000,
    schema: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              week: { type: Type.INTEGER },
              day_of_week: { type: Type.INTEGER },
              item_type: {
                type: Type.STRING,
                enum: [
                  "strength",
                  "mobility",
                  "stretch",
                  "recovery",
                  "meal_note",
                ],
              },
              title: { type: Type.STRING },
              description: { type: Type.STRING, nullable: true },
              details: {
                type: Type.OBJECT,
                properties: {
                  duration_min: { type: Type.NUMBER, nullable: true },
                  notes: { type: Type.STRING, nullable: true },
                  video_query: { type: Type.STRING, nullable: true },
                },
              },
            },
            required: ["week", "day_of_week", "item_type", "title"],
          },
        },
      },
      required: ["summary", "items"],
    },
  });

  if (!result) {
    return {
      error:
        "AI plan generation is temporarily unavailable (quota or network) — try again later",
    };
  }

  try {
    const raw = JSON.parse(result.text) as {
      summary?: string;
      items?: unknown;
    };
    const items = validateItems(raw.items);
    if (items.length < intake.weeks_total * 3) {
      return { error: "AI returned an incomplete plan — try again" };
    }
    return {
      summary: String(raw.summary ?? "").slice(0, 1000),
      items,
      raw,
      model: result.model,
    };
  } catch (error) {
    console.error("Hypertrophy plan parse failed:", error);
    return {
      error:
        "AI plan generation is temporarily unavailable (quota or network) — try again later",
    };
  }
}
