"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { parseFit, parseGpx, type ActivitySummary } from "@/lib/activity-parse";
import {
  parseTimeToSeconds,
  raceDistanceKm,
  RACE_DISTANCES_KM,
  RACE_TARGETS,
  type RaceTarget,
} from "@/lib/running";
import {
  generateMarathonPlan,
  validateItems,
  type MarathonIntake,
} from "@/lib/ai/marathon";
import {
  generateHypertrophyPlan,
  type HypertrophyIntake,
} from "@/lib/ai/hypertrophy";
import { yearsSince } from "@/lib/dates";
import type { WeekScorecard } from "@/lib/scorecard";
import {
  generateSessionFeedback,
  redFlagPrecheck,
} from "@/lib/ai/session-feedback";

export type MarathonActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
  /** Parsed watch-file summaries, held client-side until generation. */
  activities?: ActivitySummary[];
  /** AI feedback on a logged session (validated, non-fatal on failure). */
  feedback?: { message: string; flag: string };
};

const MAX_FILES = 3;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Parse uploaded GPX/FIT files into run summaries (nothing is persisted). */
export async function parseActivitiesAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const files = formData
    .getAll("activities")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) {
    return { error: "Choose at least one .fit or .gpx file" };
  }
  if (files.length > MAX_FILES) {
    return { error: `Upload at most ${MAX_FILES} files at a time` };
  }

  const summaries: ActivitySummary[] = [];
  const failed: string[] = [];

  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      failed.push(`${file.name}: larger than 4MB`);
      continue;
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name.toLowerCase();
    const summary = name.endsWith(".fit")
      ? parseFit(buffer)
      : name.endsWith(".gpx")
        ? parseGpx(buffer)
        : null;
    if (summary) {
      summaries.push(summary);
    } else {
      failed.push(`${file.name}: could not parse (use .fit or .gpx exports)`);
    }
  }

  if (summaries.length === 0) {
    return { error: failed.join(" · ") || "No parseable files" };
  }

  return {
    success: true,
    status: failed.length > 0 ? "info" : "success",
    message:
      `${summaries.length} ${summaries.length === 1 ? "run" : "runs"} parsed` +
      (failed.length > 0 ? `; skipped — ${failed.join(" · ")}` : "") +
      ".",
    activities: summaries,
  };
}

function optionalTime(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return parseTimeToSeconds(raw) !== null ? raw : null;
}

function optionalNumber(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function generatePlanAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const raceTargetRaw = String(formData.get("race_target") ?? "").trim();
  const raceTarget = RACE_TARGETS.find(
    (entry) => entry.value === raceTargetRaw,
  )?.value as RaceTarget | undefined;
  if (!raceTarget) {
    return { error: "Pick your race distance" };
  }
  const customKm = optionalNumber(formData.get("custom_distance_km"));
  const distanceKm = raceDistanceKm(raceTarget, customKm);
  if (!distanceKm || distanceKm < 1 || distanceKm > 500) {
    return { error: "Enter the race distance in km (1-500)" };
  }

  const experienceRaw = String(formData.get("experience_level") ?? "").trim();
  const experienceLevel = ["new", "recreational", "regular", "competitive"].includes(
    experienceRaw,
  )
    ? experienceRaw
    : null;

  const raceDateRaw = String(formData.get("race_date") ?? "").trim();
  const raceDate = new Date(`${raceDateRaw}T00:00:00`);
  if (!raceDateRaw || Number.isNaN(raceDate.getTime())) {
    return { error: "Pick your race date" };
  }
  const weeksUntil = Math.floor(
    (raceDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000),
  );
  if (weeksUntil < 4) {
    return { error: "Race must be at least 4 weeks away for a useful plan" };
  }
  const weeksTotal = Math.min(weeksUntil, 24);

  const daysPerWeek = Number(formData.get("days_per_week"));
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 7) {
    return { error: "Pick 2-7 training days per week" };
  }

  let activities: ActivitySummary[] = [];
  const activitiesJson = String(formData.get("activities_json") ?? "");
  if (activitiesJson) {
    try {
      const parsed = JSON.parse(activitiesJson);
      if (Array.isArray(parsed)) activities = parsed.slice(0, 20);
    } catch {
      // ignore malformed hidden field — activities are optional
    }
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("birth_date, sex, height_cm, weight_kg, training_history")
    .eq("id", user.id)
    .single();

  const age = profile?.birth_date
    ? Math.floor(
        (Date.now() - new Date(profile.birth_date).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  const pb5k = optionalTime(formData.get("pb_5k"));
  const pb10k = optionalTime(formData.get("pb_10k"));
  const pbHalf = optionalTime(formData.get("pb_half"));
  const pbFull = optionalTime(formData.get("pb_full"));
  // First time at this distance = no PB at or beyond the target.
  const longestPbKm = pbFull
    ? RACE_DISTANCES_KM.pb_full
    : pbHalf
      ? RACE_DISTANCES_KM.pb_half
      : pb10k
        ? RACE_DISTANCES_KM.pb_10k
        : pb5k
          ? RACE_DISTANCES_KM.pb_5k
          : 0;
  const firstTimeAtDistance = longestPbKm < distanceKm - 0.01;

  const intake: MarathonIntake = {
    plan_kind: "race",
    race_date: raceDateRaw,
    race_target: raceTarget,
    race_distance_km: distanceKm,
    experience_level: experienceLevel,
    first_time_at_distance: firstTimeAtDistance,
    goal_time: optionalTime(formData.get("goal_time")),
    weeks_total: weeksTotal,
    days_per_week: daysPerWeek,
    pb_5k: pb5k,
    pb_10k: pb10k,
    pb_half: pbHalf,
    pb_full: pbFull,
    weekly_km: optionalNumber(formData.get("weekly_km")),
    longest_run_km: optionalNumber(formData.get("longest_run_km")),
    injuries: String(formData.get("injuries") ?? "").trim() || null,
    age,
    sex: profile?.sex ?? null,
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    training_history: profile?.training_history ?? null,
    activities,
  };

  const plan = await generateMarathonPlan(intake);
  if ("error" in plan) {
    return { error: plan.error };
  }

  const { data, error } = await supabase.rpc("create_training_plan", {
    p_race_date: raceDateRaw,
    p_goal_time: intake.goal_time,
    p_weeks_total: weeksTotal,
    p_summary: plan.summary,
    p_intake: intake as unknown as Record<string, unknown>,
    p_raw: plan.raw as Record<string, unknown>,
    p_model: plan.model,
    p_items: plan.items as unknown as Record<string, unknown>[],
  });

  if (error || !data?.success) {
    console.error("create_training_plan failed:", error ?? data);
    return { error: data?.error ?? "Failed to save the plan" };
  }

  revalidatePath("/marathon");
  revalidatePath("/dashboard");
  redirect("/marathon");
}

const HYPERTROPHY_GOALS = new Set(["muscle_gain", "recomp"]);
const EQUIPMENT_OPTIONS = new Set(["gym", "home", "bodyweight"]);

export async function generateHypertrophyPlanAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const goal = String(formData.get("goal") ?? "").trim();
  if (!HYPERTROPHY_GOALS.has(goal)) return { error: "Pick a goal" };

  const equipment = String(formData.get("equipment") ?? "").trim();
  if (!EQUIPMENT_OPTIONS.has(equipment)) return { error: "Pick your equipment" };

  const daysPerWeek = Number(formData.get("days_per_week"));
  if (!Number.isInteger(daysPerWeek) || daysPerWeek < 2 || daysPerWeek > 6) {
    return { error: "Pick 2-6 training days per week" };
  }

  const weeksTotal = Number(formData.get("weeks_total"));
  if (![8, 10, 12].includes(weeksTotal)) {
    return { error: "Pick a plan length" };
  }

  const experienceLevel =
    String(formData.get("experience_level") ?? "").trim() || null;

  const supabase = await createClient();
  const [{ data: profile }, { data: calorieGoal }, { data: analyzedPhoto }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("birth_date, sex, height_cm, weight_kg, training_history")
        .eq("id", user.id)
        .single(),
      supabase
        .from("goals")
        .select("target_value")
        .eq("user_id", user.id)
        .eq("goal_type", "calorie_intake")
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("body_photos")
        .select("analysis")
        .eq("user_id", user.id)
        .not("analysis", "is", null)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const analysis = analyzedPhoto?.analysis as {
    build_notes?: string;
    posture_notes?: string;
  } | null;
  const bodyAnalysis = analysis
    ? [analysis.build_notes, analysis.posture_notes]
        .filter(Boolean)
        .join(" ")
        .slice(0, 500) || null
    : null;

  const intake: HypertrophyIntake = {
    goal,
    experience_level: experienceLevel,
    equipment,
    days_per_week: daysPerWeek,
    weeks_total: weeksTotal,
    injuries: String(formData.get("injuries") ?? "").trim() || null,
    calorie_target: calorieGoal?.target_value
      ? Number(calorieGoal.target_value)
      : null,
    body_analysis: bodyAnalysis,
    age: yearsSince(profile?.birth_date),
    sex: profile?.sex ?? null,
    height_cm: profile?.height_cm ?? null,
    weight_kg: profile?.weight_kg ?? null,
    training_history: profile?.training_history ?? null,
  };

  const plan = await generateHypertrophyPlan(intake);
  if ("error" in plan) {
    return { error: plan.error };
  }

  const { data, error } = await supabase.rpc("create_training_plan", {
    p_race_date: null,
    p_goal_time: null,
    p_weeks_total: weeksTotal,
    p_summary: plan.summary,
    p_intake: { plan_kind: "hypertrophy", ...intake } as unknown as Record<
      string,
      unknown
    >,
    p_raw: plan.raw as Record<string, unknown>,
    p_model: plan.model,
    p_items: plan.items as unknown as Record<string, unknown>[],
  });

  if (error || !data?.success) {
    console.error("create_training_plan (hypertrophy) failed:", error ?? data);
    return { error: data?.error ?? "Failed to save the plan" };
  }

  revalidatePath("/marathon");
  revalidatePath("/dashboard");
  redirect("/marathon");
}

export async function togglePlanItemAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const itemId = String(formData.get("item_id") ?? "").trim();
  const completed = formData.get("completed") === "true";
  if (!itemId) return { error: "Missing item id" };

  const supabase = await createClient();
  // RLS restricts the update to items of the user's own plans.
  const { error } = await supabase
    .from("plan_items")
    .update({ is_completed: completed })
    .eq("id", itemId);

  if (error) {
    console.error("plan item toggle failed:", error);
    return { error: "Failed to update the item" };
  }

  revalidatePath("/marathon");
  return { success: true };
}

type ExerciseEntry = {
  name: string;
  sets: number;
  reps: number;
  weight_kg?: number;
};

const MAX_EXERCISES = 20;

/** Validate a client-serialized exercises array field-by-field (style copied
 *  from validateItems in lib/ai/marathon.ts). Invalid entries are dropped. */
function validateExercises(raw: unknown): ExerciseEntry[] {
  if (!Array.isArray(raw)) return [];
  const exercises: ExerciseEntry[] = [];
  for (const entry of raw.slice(0, MAX_EXERCISES)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const name = String(item.name ?? "").trim();
    const sets = Number(item.sets);
    const reps = Number(item.reps);
    if (!name) continue;
    if (!Number.isInteger(sets) || sets < 1 || sets > 50) continue;
    if (!Number.isInteger(reps) || reps < 1 || reps > 50) continue;
    const exercise: ExerciseEntry = { name: name.slice(0, 80), sets, reps };
    const weight = Number(item.weight_kg);
    if (
      item.weight_kg !== undefined &&
      item.weight_kg !== null &&
      Number.isFinite(weight) &&
      weight > 0
    ) {
      exercise.weight_kg = Math.round(weight * 10) / 10;
    }
    exercises.push(exercise);
  }
  return exercises;
}

/** Log how a completed run/strength session actually went (everything beyond
 *  the plan item reference is optional) and award +10 XP idempotently. */
export async function logSessionAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const planItemId = String(formData.get("plan_item_id") ?? "").trim();
  if (!planItemId) return { error: "Missing plan item id" };

  const sport = String(formData.get("sport") ?? "").trim();
  if (sport !== "run" && sport !== "strength") {
    return { error: "Only run and strength sessions can be logged" };
  }

  let rpe: number | null = null;
  const rpeRaw = String(formData.get("rpe") ?? "").trim();
  if (rpeRaw) {
    const parsed = Number(rpeRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
      return { error: "RPE must be between 1 and 10" };
    }
    rpe = parsed;
  }

  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;

  // Sport-shaped `actual` payload — every field optional.
  const actual: Record<string, unknown> = {};
  if (sport === "run") {
    const distanceKm = optionalNumber(formData.get("distance_km"));
    const durationMin = optionalNumber(formData.get("duration_min"));
    const avgHr = optionalNumber(formData.get("avg_hr"));
    if (distanceKm !== null) actual.distance_km = distanceKm;
    if (durationMin !== null) actual.duration_min = durationMin;
    if (avgHr !== null) actual.avg_hr = Math.round(avgHr);
  } else {
    const exercisesJson = String(formData.get("exercises_json") ?? "");
    if (exercisesJson) {
      try {
        const exercises = validateExercises(JSON.parse(exercisesJson));
        if (exercises.length > 0) actual.exercises = exercises;
      } catch {
        // ignore malformed hidden field — exercises are optional
      }
    }
  }

  const supabase = await createClient();

  // RLS scopes plan_items to the user's own plans — a foreign item returns null.
  const { data: item } = await supabase
    .from("plan_items")
    .select("id, item_type, title, details")
    .eq("id", planItemId)
    .maybeSingle();
  if (!item) return { error: "Plan item not found" };
  if (item.item_type !== sport) {
    return { error: "Session type does not match the plan item" };
  }

  const { data: log, error } = await supabase
    .from("session_logs")
    .insert({
      user_id: user.id,
      plan_item_id: planItemId,
      sport,
      rpe,
      actual,
      note,
    })
    .select("id")
    .single();

  if (error || !log) {
    if (error?.code === "23505") {
      return { error: "Session already logged" };
    }
    console.error("session log insert failed:", error);
    return { error: "Failed to log the session" };
  }

  // Logging implies the item is done (same update as togglePlanItemAction).
  const { error: toggleError } = await supabase
    .from("plan_items")
    .update({ is_completed: true })
    .eq("id", planItemId);
  if (toggleError) {
    console.error("plan item completion failed:", toggleError);
  }

  const { data: xp } = await supabase.rpc("award_session_log_xp", {
    p_session_log_id: log.id,
  });
  const awardedXp = Number(xp?.awarded_xp ?? 0);

  // AI feedback is NON-FATAL — the session save + XP above already succeeded,
  // and any error here is swallowed.
  let feedback: { message: string; flag: string } | undefined;
  try {
    const result = await generateSessionFeedback({
      itemTitle: String(item.title ?? ""),
      itemType: item.item_type,
      planned:
        typeof item.details === "object" && item.details !== null
          ? (item.details as Record<string, unknown>)
          : null,
      actual,
      rpe,
      note,
    });
    if ("error" in result) {
      console.error("session feedback unavailable:", result.error);
      // Persist the deterministic flag anyway — the weekly scorecard reads
      // ai_feedback.flag, and a pain note must survive an AI outage.
      const flag = redFlagPrecheck(note, rpe, item.item_type);
      if (flag !== "ok") {
        feedback = {
          message: "Your note was flagged — take it easy and monitor how it feels.",
          flag,
        };
      }
    } else {
      feedback = result;
    }
    if (feedback) {
      const { error: feedbackError } = await supabase
        .from("session_logs")
        .update({ ai_feedback: feedback })
        .eq("id", log.id);
      if (feedbackError) {
        console.error("session feedback save failed:", feedbackError);
      }
    }
  } catch (feedbackException) {
    console.error("session feedback failed:", feedbackException);
  }

  revalidatePath("/marathon");
  const baseMessage =
    awardedXp > 0 ? `Session logged · +${awardedXp} XP` : "Session logged.";
  return {
    success: true,
    message: feedback ? `${baseMessage} 🏃 ${feedback.message}` : baseMessage,
    feedback,
  };
}

const CHECKIN_DECISIONS = new Set(["advance", "repeat", "deload"]);

/** Rebuild a scorecard from a client-posted JSON string — never trust the
 *  posted shape; only known numeric/string-array fields survive. */
function sanitizeScorecard(raw: unknown): WeekScorecard | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const num = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;
  const strings = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.slice(0, 500))
          .slice(0, 20)
      : [];
  return {
    adherence_pct: Math.min(Math.max(num(record.adherence_pct), 0), 100),
    planned_items: num(record.planned_items),
    completed_items: num(record.completed_items),
    planned_km: num(record.planned_km),
    actual_km: num(record.actual_km),
    red_flags: strings(record.red_flags),
    caution_flags: strings(record.caution_flags),
  };
}

/** Confirm a weekly check-in: records the scorecard + decision and rewrites
 *  ONLY the target week via the apply_week_adjustment RPC (which also awards
 *  +20 XP idempotently). Everything is re-validated server-side. */
export async function applyCheckinAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) return { error: "Missing plan id" };

  const checkinWeek = Number(formData.get("checkin_week"));
  const targetWeek = Number(formData.get("target_week"));
  if (
    !Number.isInteger(checkinWeek) ||
    !Number.isInteger(targetWeek) ||
    checkinWeek < 1 ||
    targetWeek !== checkinWeek + 1
  ) {
    return { error: "Invalid check-in week" };
  }

  const decision = String(formData.get("decision") ?? "").trim();
  if (!CHECKIN_DECISIONS.has(decision)) {
    return { error: "Invalid decision" };
  }

  const summary = String(formData.get("summary") ?? "").trim().slice(0, 500);

  let scorecard: WeekScorecard | null = null;
  try {
    scorecard = sanitizeScorecard(
      JSON.parse(String(formData.get("scorecard_json") ?? "")),
    );
  } catch {
    // handled below
  }
  if (!scorecard) return { error: "Invalid scorecard" };

  // Re-run the same field-by-field validation as plan generation on the
  // posted items, then force every item onto the target week.
  let items: ReturnType<typeof validateItems> = [];
  try {
    items = validateItems(
      JSON.parse(String(formData.get("items_json") ?? "")),
    ).map((item) => ({ ...item, week: targetWeek }));
  } catch {
    // handled below
  }
  if (items.length === 0) {
    return { error: "The adjusted week has no valid items" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_week_adjustment", {
    p_plan_id: planId,
    p_checkin_week: checkinWeek,
    p_scorecard: scorecard as unknown as Record<string, unknown>,
    p_decision: decision,
    p_summary: summary || null,
    p_target_week: targetWeek,
    p_items: items as unknown as Record<string, unknown>[],
  });

  if (error || !data?.success) {
    console.error("apply_week_adjustment failed:", error ?? data);
    return { error: data?.error ?? "Failed to apply the check-in" };
  }

  revalidatePath("/marathon");
  revalidatePath("/dashboard");
  redirect("/marathon");
}

export async function archivePlanAction(
  _prevState: MarathonActionState,
  formData: FormData,
): Promise<MarathonActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const planId = String(formData.get("plan_id") ?? "").trim();
  if (!planId) return { error: "Missing plan id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("training_plans")
    .update({ status: "archived" })
    .eq("id", planId)
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error("plan archive failed:", error);
    return { error: "Failed to archive the plan" };
  }

  revalidatePath("/marathon");
  revalidatePath("/dashboard");
  return { success: true, message: "Plan archived.", status: "info" };
}
