"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { parseFit, parseGpx, type ActivitySummary } from "@/lib/activity-parse";
import { parseTimeToSeconds } from "@/lib/running";
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

  const intake: MarathonIntake = {
    race_date: raceDateRaw,
    goal_time: optionalTime(formData.get("goal_time")),
    weeks_total: weeksTotal,
    days_per_week: daysPerWeek,
    pb_5k: optionalTime(formData.get("pb_5k")),
    pb_10k: optionalTime(formData.get("pb_10k")),
    pb_half: optionalTime(formData.get("pb_half")),
    pb_full: optionalTime(formData.get("pb_full")),
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
