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
  type MarathonIntake,
} from "@/lib/ai/marathon";

export type MarathonActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
  /** Parsed watch-file summaries, held client-side until generation. */
  activities?: ActivitySummary[];
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
    .select("id, item_type")
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

  revalidatePath("/marathon");
  return {
    success: true,
    message: awardedXp > 0 ? `Session logged · +${awardedXp} XP` : "Session logged.",
  };
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
