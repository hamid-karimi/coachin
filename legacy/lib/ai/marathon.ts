/**
 * Marathon plan generation via Gemini structured output (roadmap branch 4).
 * Server-only. The response is validated field-by-field before persisting —
 * never trust AI output shapes (roadmap global anti-pattern).
 */
import { Type } from "@google/genai";
import { generateJsonText } from "./text-json";
import { anchorsPromptBlock, type PlanAnchor } from "./anchors";
import type { ActivitySummary } from "@/lib/activity-parse";

export type MarathonIntake = {
  /** Discriminates plan flavors inside training_plans.intake. */
  plan_kind: "race";
  /** Null for a "base" plan (just start running, no race). */
  race_date: string | null;
  /** "base" | "5k" | "10k" | "half" | "full" | "ultra" | "other" */
  race_target: string;
  /** 0 for a "base" plan — there is no target distance. */
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
  /** Fixed weekly commitments (schedules) — prompt constraints only. */
  anchors: PlanAnchor[];
};

export type PlanItemInput = {
  week: number;
  day_of_week: number;
  item_type:
    | "run"
    | "strength"
    | "stretch"
    | "mobility"
    | "recovery"
    | "meal_note";
  /** Short human-readable session name (≤60 chars), the card text. */
  title: string;
  /** Full session detail — exercise list, structure — shown in detail views. */
  description?: string;
  details: {
    distance_km?: number;
    pace_min_km?: string;
    duration_min?: number;
    notes?: string;
    /** YouTube SEARCH query for form videos — never a direct video URL. */
    video_query?: string;
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
  "mobility",
  "recovery",
  "meal_note",
]);

export function validateItems(raw: unknown): PlanItemInput[] {
  if (!Array.isArray(raw)) return [];
  const items: PlanItemInput[] = [];
  for (const entry of raw.slice(0, 400)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const week = Number(item.week);
    const day = Number(item.day_of_week);
    const type = String(item.item_type ?? "");
    const title = String(item.title ?? "").trim();
    const description =
      typeof item.description === "string" ? item.description.trim() : "";
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
      description: description ? description.slice(0, 2000) : undefined,
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
        video_query:
          typeof details.video_query === "string" &&
          details.video_query.trim() !== ""
            ? details.video_query.trim().slice(0, 80)
            : undefined,
      },
    });
  }
  return items;
}

export async function generateMarathonPlan(
  intake: MarathonIntake,
): Promise<GeneratedPlan | { error: string }> {
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

  const isBase = intake.race_target === "base";

  // "" when the athlete has no fixed commitments — filtered out below.
  const anchorConstraints = anchorsPromptBlock(intake.anchors);

  const commonRules = [
    `- Exactly ${intake.days_per_week} training days per week (day_of_week: 0=Sunday..6=Saturday); remaining days get ONE recovery item.`,
    `- Every item: "title" is a SHORT human-readable session name, max 60 characters (e.g. "Easy run 5k", "Strength — hips & core", "Long run 18k"). Put the full exercise list and session detail in "description" — NEVER in the title.`,
    `- Every run item: details.distance_km, details.pace_min_km (like "5:40"), short details.notes.`,
    `- Add ONE meal_note item per week (day_of_week of the long run) with practical fueling guidance in details.notes.`,
    `- Strength items must be RUNNER-SPECIFIC — hips, glutes, calves, core, with a single-leg bias — short title (e.g. "Strength — single-leg focus") and the concrete exercise list with sets x reps in "description" (e.g. "Single-leg RDL 3x10 + calf raises 3x15 + side plank 3x30s").${intake.experience_level === "new" ? " The athlete is new: bodyweight-first strength, no barbell work." : ""}`,
    `- Every strength, stretch and mobility item (and run items with drills) gets details.video_query: a concise English YouTube SEARCH query for exercise form (e.g. "single leg romanian deadlift form"), max 80 chars. NEVER produce a youtube.com URL or a video id — only the search words.`,
    `- Respect the athlete's current volume: never jump weekly km more than ~10%.`,
    `- summary: 2-3 sentences describing the plan's approach.`,
  ];

  const prompt = isBase
    ? [
        `Create a ${intake.weeks_total}-week BASE-BUILDING running plan for someone who just wants to start running and build a consistent, injury-free habit. There is NO race and NO goal time — do NOT include a taper, goal-pace work, or race-specific peaking.`,
        `Athlete: ${athlete || "unknown"}. Experience: ${experience}. Training history: ${intake.training_history || "unknown"}.`,
        `PBs: ${pbs || "none"}. Current weekly volume: ${intake.weekly_km ?? "unknown"}km, longest recent run ${intake.longest_run_km ?? "unknown"}km.`,
        `Recent uploaded runs: ${recent}.`,
        `Injuries/limitations: ${intake.injuries || "none reported"}.`,
        anchorConstraints,
        `Rules:`,
        `- Weekly structure: mostly EASY, conversational-pace runs (use run/walk intervals for a new runner), ONE slightly longer run that grows gently, strength 1-2x, stretch 1x, and ONE mobility item (item_type "mobility": hip/ankle mobility or yoga-for-runners).`,
        `- Progress volume gradually week over week with a lighter "stepback" every 4th week; keep intensity low — the goal is aerobic base and consistency, not speed.`,
        `- Titles short and concrete ("Easy run 4k", "Run/walk 30min", "Easy run 6k").`,
        ...commonRules,
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `Create a ${intake.weeks_total}-week training plan for a ${intake.race_distance_km}km race (${intake.race_target}).`,
        `Athlete: ${athlete || "unknown"}. Experience: ${experience}. Training history: ${intake.training_history || "unknown"}.`,
        intake.first_time_at_distance
          ? `This is the athlete's FIRST race at this distance — no PB at or beyond ${intake.race_distance_km}km. Prioritize finishing healthy over time goals; be conservative with volume and pace targets.`
          : null,
        `PBs: ${pbs || "none"}. Current weekly volume: ${intake.weekly_km ?? "unknown"}km, longest recent run ${intake.longest_run_km ?? "unknown"}km.`,
        `Recent uploaded runs: ${recent}.`,
        `Race date: ${intake.race_date}. Goal time: ${intake.goal_time ?? "finish comfortably"}.`,
        `Injuries/limitations: ${intake.injuries || "none reported"}.`,
        anchorConstraints,
        `Rules:`,
        `- Weekly structure: quality run(s), easy runs, one long run (progressing, stepback every 4th week, taper appropriately for the race distance), strength 1-2x, stretch 1x, and ONE mobility item (item_type "mobility": hip/ankle mobility or yoga-for-runners).`,
        `- Scale everything to the ${intake.race_distance_km}km target: long-run peaks, interval distances, and taper length must fit the race distance and the athlete's experience level.`,
        `- Titles short and concrete ("Easy run 8k", "Intervals 6x800m", "Long run 26k").`,
        ...commonRules,
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
                  "run",
                  "strength",
                  "stretch",
                  "mobility",
                  "recovery",
                  "meal_note",
                ],
              },
              title: { type: Type.STRING },
              description: { type: Type.STRING, nullable: true },
              details: {
                type: Type.OBJECT,
                properties: {
                  distance_km: { type: Type.NUMBER, nullable: true },
                  pace_min_km: { type: Type.STRING, nullable: true },
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
    console.error("Marathon plan parse failed:", error);
    return {
      error:
        "AI plan generation is temporarily unavailable (quota or network) — try again later",
    };
  }
}
