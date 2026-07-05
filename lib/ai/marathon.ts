/**
 * Marathon plan generation via Gemini structured output (roadmap branch 4).
 * Server-only. The response is validated field-by-field before persisting —
 * never trust AI output shapes (roadmap global anti-pattern).
 */
import { Type } from "@google/genai";
import { getGeminiClient, getGeminiModel } from "./gemini";
import type { ActivitySummary } from "@/lib/activity-parse";

export type MarathonIntake = {
  race_date: string;
  /** "5k" | "10k" | "half" | "full" | "ultra" | "other" */
  race_target: string;
  race_distance_km: number;
  /** "new" | "recreational" | "regular" | "competitive" */
  experience_level: string | null;
  /** True when the runner has no PB at (or beyond) the target distance. */
  first_time_at_distance: boolean;
  goal_time: string | null;
  weeks_total: number;
  days_per_week: number;
  pb_5k: string | null;
  pb_10k: string | null;
  pb_half: string | null;
  pb_full: string | null;
  weekly_km: number | null;
  longest_run_km: number | null;
  injuries: string | null;
  // profile snapshot
  age: number | null;
  sex: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_history: string | null;
  activities: ActivitySummary[];
};

export type PlanItemInput = {
  week: number;
  day_of_week: number;
  item_type: "run" | "strength" | "stretch" | "recovery" | "meal_note";
  title: string;
  details: {
    distance_km?: number;
    pace_min_km?: string;
    duration_min?: number;
    notes?: string;
  };
};

export type GeneratedPlan = {
  summary: string;
  items: PlanItemInput[];
  raw: unknown;
  model: string;
};

const ITEM_TYPES = new Set([
  "run",
  "strength",
  "stretch",
  "recovery",
  "meal_note",
]);

function validateItems(raw: unknown): PlanItemInput[] {
  if (!Array.isArray(raw)) return [];
  const items: PlanItemInput[] = [];
  for (const entry of raw.slice(0, 400)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const week = Number(item.week);
    const day = Number(item.day_of_week);
    const type = String(item.item_type ?? "");
    const title = String(item.title ?? "").trim();
    if (!Number.isInteger(week) || week < 1 || week > 24) continue;
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (!ITEM_TYPES.has(type) || !title) continue;
    const details = (
      typeof item.details === "object" && item.details !== null
        ? item.details
        : {}
    ) as PlanItemInput["details"];
    items.push({
      week,
      day_of_week: day,
      item_type: type as PlanItemInput["item_type"],
      title: title.slice(0, 200),
      details: {
        distance_km:
          typeof details.distance_km === "number"
            ? Math.round(details.distance_km * 10) / 10
            : undefined,
        pace_min_km:
          typeof details.pace_min_km === "string"
            ? details.pace_min_km.slice(0, 20)
            : undefined,
        duration_min:
          typeof details.duration_min === "number"
            ? Math.round(details.duration_min)
            : undefined,
        notes:
          typeof details.notes === "string"
            ? details.notes.slice(0, 500)
            : undefined,
      },
    });
  }
  return items;
}

export async function generateMarathonPlan(
  intake: MarathonIntake,
): Promise<GeneratedPlan | { error: string }> {
  const client = getGeminiClient();
  if (!client) {
    return { error: "AI is not configured (missing GEMINI_API_KEY)" };
  }
  const model = getGeminiModel();

  const athlete = [
    intake.age ? `age ${intake.age}` : null,
    intake.sex,
    intake.height_cm ? `${intake.height_cm}cm` : null,
    intake.weight_kg ? `${intake.weight_kg}kg` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const pbs = [
    intake.pb_5k ? `5k ${intake.pb_5k}` : null,
    intake.pb_10k ? `10k ${intake.pb_10k}` : null,
    intake.pb_half ? `half ${intake.pb_half}` : null,
    intake.pb_full ? `marathon ${intake.pb_full}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const recent =
    intake.activities.length > 0
      ? intake.activities
          .slice(0, 20)
          .map(
            (activity) =>
              `${activity.date}: ${activity.distance_km}km in ${activity.duration_min}min` +
              (activity.avg_hr ? ` (avg HR ${activity.avg_hr})` : ""),
          )
          .join("; ")
      : "none provided";

  const experience =
    {
      new: "new to structured running (build from walk/run basics, prioritize consistency over speed)",
      recreational: "recreational runner (runs casually, little structured training)",
      regular: "regular racer (trains consistently, has raced before)",
      competitive: "competitive runner (high volume, structured training background)",
    }[intake.experience_level ?? ""] ?? "unknown experience level";

  const prompt = [
    `Create a ${intake.weeks_total}-week training plan for a ${intake.race_distance_km}km race (${intake.race_target}).`,
    `Athlete: ${athlete || "unknown"}. Experience: ${experience}. Training history: ${intake.training_history || "unknown"}.`,
    intake.first_time_at_distance
      ? `This is the athlete's FIRST race at this distance — no PB at or beyond ${intake.race_distance_km}km. Prioritize finishing healthy over time goals; be conservative with volume and pace targets.`
      : null,
    `PBs: ${pbs || "none"}. Current weekly volume: ${intake.weekly_km ?? "unknown"}km, longest recent run ${intake.longest_run_km ?? "unknown"}km.`,
    `Recent uploaded runs: ${recent}.`,
    `Race date: ${intake.race_date}. Goal time: ${intake.goal_time ?? "finish comfortably"}.`,
    `Injuries/limitations: ${intake.injuries || "none reported"}.`,
    `Rules:`,
    `- Exactly ${intake.days_per_week} training days per week (day_of_week: 0=Sunday..6=Saturday); remaining days get ONE recovery item.`,
    `- Weekly structure: quality run(s), easy runs, one long run (progressing, stepback every 4th week, taper appropriately for the race distance), strength 1-2x, stretch/mobility 1x.`,
    `- Scale everything to the ${intake.race_distance_km}km target: long-run peaks, interval distances, and taper length must fit the race distance and the athlete's experience level.`,
    `- Every run item: details.distance_km, details.pace_min_km (like "5:40"), short details.notes.`,
    `- Add ONE meal_note item per week (day_of_week of the long run) with practical fueling guidance in details.notes.`,
    `- Titles short and concrete ("Easy run 8k", "Intervals 6x800m", "Long run 26k").`,
    `- Respect the athlete's current volume: never jump weekly km more than ~10%.`,
    `- summary: 2-3 sentences describing the plan's approach.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
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
                      "run",
                      "strength",
                      "stretch",
                      "recovery",
                      "meal_note",
                    ],
                  },
                  title: { type: Type.STRING },
                  details: {
                    type: Type.OBJECT,
                    properties: {
                      distance_km: { type: Type.NUMBER, nullable: true },
                      pace_min_km: { type: Type.STRING, nullable: true },
                      duration_min: { type: Type.NUMBER, nullable: true },
                      notes: { type: Type.STRING, nullable: true },
                    },
                  },
                },
                required: ["week", "day_of_week", "item_type", "title"],
              },
            },
          },
          required: ["summary", "items"],
        },
      },
    });

    const raw = JSON.parse(response.text ?? "{}") as {
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
      model,
    };
  } catch (error) {
    console.error("Marathon plan generation failed:", error);
    return {
      error:
        "AI plan generation is temporarily unavailable (quota or network) — try again later",
    };
  }
}
