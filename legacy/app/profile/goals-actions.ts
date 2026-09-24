"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { GOAL_TYPE_META, type GoalType } from "@/lib/goals";
import type { ProfileActionState } from "./actions";

const GOAL_TYPES = Object.keys(GOAL_TYPE_META) as GoalType[];

export async function createGoalAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const goalType = String(formData.get("goal_type") ?? "").trim() as GoalType;
  if (!GOAL_TYPES.includes(goalType)) {
    return { error: "Pick a goal type" };
  }

  const target = Number(String(formData.get("target_value") ?? "").trim());
  if (!Number.isFinite(target) || target <= 0) {
    return { error: "Target must be a positive number" };
  }

  const startRaw = String(formData.get("start_value") ?? "").trim();
  const start = startRaw ? Number(startRaw) : null;
  if (start !== null && (!Number.isFinite(start) || start <= 0)) {
    return { error: "Starting value must be a positive number" };
  }

  const targetDateRaw = String(formData.get("target_date") ?? "").trim();
  if (targetDateRaw && Number.isNaN(new Date(targetDateRaw).getTime())) {
    return { error: "Enter a valid target date" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    goal_type: goalType,
    target_value: target,
    start_value: start,
    target_date: targetDateRaw || null,
  });

  if (error) {
    // Partial unique index: one active goal per type.
    if (error.code === "23505") {
      return {
        error: `You already have an active ${GOAL_TYPE_META[goalType].label.toLowerCase()} goal`,
      };
    }
    console.error("Error creating goal:", error);
    return { error: "Failed to create goal" };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true, message: "Goal created.", status: "success" };
}

export async function abandonGoalAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const goalId = String(formData.get("goal_id") ?? "").trim();
  if (!goalId) {
    return { error: "Missing goal id" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({ status: "abandoned" })
    .eq("id", goalId)
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error("Error abandoning goal:", error);
    return { error: "Failed to remove goal" };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true, message: "Goal removed.", status: "info" };
}
