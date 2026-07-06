/**
 * AI rewrite of a single upcoming plan week within a deterministic check-in
 * decision (adaptive plan Phase 3). Server-only. The decision itself comes
 * from lib/scorecard.ts rules — the AI only adjusts items WITHIN it and
 * explains why in <=2 sentences. Output goes through validateItems and every
 * item's week is forced to the target week afterwards.
 */
import { Type } from "@google/genai";
import { generateJsonText } from "./text-json";
import { validateItems, type PlanItemInput } from "./marathon";
import type { CheckinDecision, WeekScorecard } from "@/lib/scorecard";

export type WeekAdjustment = {
  items: PlanItemInput[];
  summary: string;
};

const DECISION_RULES: Record<CheckinDecision, string> = {
  deload:
    "DELOAD: reduce total volume by roughly 30-40% (shorter runs, easier paces, lighter strength). Keep the athlete moving but recovering.",
  repeat:
    "REPEAT: mirror the structure and volume of the reviewed week — do not progress. The athlete needs another pass at this load.",
  advance:
    "ADVANCE: apply a light progression (<=10% volume increase) to the given items; keep the same session types.",
};

export async function generateWeekAdjustment(input: {
  scorecard: WeekScorecard;
  decision: CheckinDecision;
  reasons: string[];
  nextWeekItems: PlanItemInput[];
  targetWeek: number;
  intakeSummary: string;
}): Promise<WeekAdjustment | { error: string }> {
  const prompt = [
    `You are adjusting ONE week of an existing training plan after a weekly review.`,
    `Plan context: ${input.intakeSummary || "unknown"}.`,
    `Reviewed week scorecard: ${JSON.stringify(input.scorecard)}.`,
    `Deterministic decision (already made — do NOT change it): ${input.decision}.`,
    `Reasons: ${input.reasons.join(" ")}`,
    `Current items of the week to rewrite (week ${input.targetWeek}):`,
    JSON.stringify(input.nextWeekItems),
    `Rules:`,
    `- ${DECISION_RULES[input.decision]}`,
    `- Rewrite ONLY these items; keep the same number of training days and the same day_of_week pattern.`,
    `- Every item: week = ${input.targetWeek}, same item schema (run items keep details.distance_km, details.pace_min_km, details.notes).`,
    `- summary: at most 2 sentences explaining what changed and why, in plain language.`,
  ].join("\n");

  const result = await generateJsonText({
    prompt,
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
                enum: ["run", "strength", "stretch", "recovery", "meal_note"],
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
  });

  if (!result) {
    return {
      error: "AI adjustment is temporarily unavailable — try again later",
    };
  }

  try {
    const raw = JSON.parse(result.text) as {
      summary?: unknown;
      items?: unknown;
    };
    // Validate field-by-field, then force every item onto the target week —
    // the AI's week numbers are never trusted.
    const items = validateItems(raw.items).map((item) => ({
      ...item,
      week: input.targetWeek,
    }));
    if (items.length === 0) {
      return { error: "AI returned no usable items" };
    }
    const summary = String(raw.summary ?? "").trim().slice(0, 500);
    if (!summary) {
      return { error: "AI returned no summary" };
    }
    return { items, summary };
  } catch (error) {
    console.error("Week adjustment parse failed:", error);
    return {
      error: "AI adjustment is temporarily unavailable — try again later",
    };
  }
}
