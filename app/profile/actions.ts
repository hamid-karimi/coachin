"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { checkGoalAchievements } from "@/lib/goal-achievements";

export type ProfileActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
  /** Labels of goals achieved by this action (drives celebration UI). */
  achievedGoals?: string[];
};

function parseOptionalNumber(
  value: FormDataEntryValue | null,
  { min, max, label }: { min: number; max: number; label: string },
): { value: number | null } | { error: string } {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { value: null };
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return { error: `${label} must be a number` };
  if (parsed < min || parsed > max) {
    return { error: `${label} must be between ${min} and ${max}` };
  }
  return { value: parsed };
}

/** Static body profile: birth date, sex, height, training history. */
export async function updateProfileAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const birthDateRaw = String(formData.get("birth_date") ?? "").trim();
  let birthDate: string | null = null;
  if (birthDateRaw) {
    const parsed = new Date(birthDateRaw);
    const age =
      (Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(parsed.getTime()) || age < 10 || age > 120) {
      return { error: "Enter a valid birth date" };
    }
    birthDate = birthDateRaw;
  }

  const sexRaw = String(formData.get("sex") ?? "").trim();
  if (sexRaw && !["male", "female", "other"].includes(sexRaw)) {
    return { error: "Invalid sex value" };
  }

  const height = parseOptionalNumber(formData.get("height_cm"), {
    min: 100,
    max: 250,
    label: "Height (cm)",
  });
  if ("error" in height) return { error: height.error };

  const trainingHistory =
    String(formData.get("training_history") ?? "").trim() || null;

  const country =
    String(formData.get("country") ?? "").trim().slice(0, 56) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      birth_date: birthDate,
      sex: sexRaw || null,
      height_cm: height.value,
      training_history: trainingHistory,
      country,
    })
    .eq("id", user.id);

  if (error) {
    console.error("Error updating profile:", error);
    return { error: "Failed to update profile" };
  }

  revalidatePath("/profile");
  return { success: true, message: "Profile updated.", status: "success" };
}

/** Trainee opt-in: share nutrition (meal logs + meal plan) with the active
 *  coach. The flag gates the coach-read RLS policies on the meal tables —
 *  flipping it off revokes access immediately. */
export async function setNutritionSharingAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const enabled = String(formData.get("enabled") ?? "") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ nutrition_sharing_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    console.error("Error updating nutrition sharing:", error);
    return { error: "Failed to update nutrition sharing" };
  }

  revalidatePath("/profile");
  revalidatePath("/coaching");
  return {
    success: true,
    message: enabled
      ? "Your coach can now see your nutrition."
      : "Nutrition sharing turned off.",
    status: enabled ? "success" : "info",
  };
}

/**
 * Log a weight / body-fat measurement: inserts into the body_measurements
 * series AND refreshes the profiles snapshot in one flow (roadmap branch 1).
 */
export async function addMeasurementAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const weight = parseOptionalNumber(formData.get("weight_kg"), {
    min: 30,
    max: 300,
    label: "Weight (kg)",
  });
  if ("error" in weight) return { error: weight.error };

  const bodyFat = parseOptionalNumber(formData.get("body_fat_pct"), {
    min: 3,
    max: 60,
    label: "Body fat (%)",
  });
  if ("error" in bodyFat) return { error: bodyFat.error };

  if (weight.value === null && bodyFat.value === null) {
    return { error: "Enter a weight or a body fat percentage" };
  }

  const supabase = await createClient();

  const { error: insertError } = await supabase.from("body_measurements").insert({
    user_id: user.id,
    weight_kg: weight.value,
    body_fat_pct: bodyFat.value,
  });

  if (insertError) {
    console.error("Error inserting measurement:", insertError);
    return { error: "Failed to save measurement" };
  }

  const snapshot: Record<string, number> = {};
  if (weight.value !== null) snapshot.weight_kg = weight.value;
  if (bodyFat.value !== null) snapshot.body_fat_pct = bodyFat.value;

  const { error: snapshotError } = await supabase
    .from("profiles")
    .update(snapshot)
    .eq("id", user.id);

  if (snapshotError) {
    // Series row saved; snapshot is derived data — report success anyway.
    console.error("Error updating profile snapshot:", snapshotError);
  }

  // Settle any weight / body-fat goals this measurement just crossed.
  const achievedGoals = await checkGoalAchievements(supabase, user.id, {
    weight_kg: weight.value,
    body_fat_pct: bodyFat.value,
  });

  revalidatePath("/profile");
  revalidatePath("/dashboard");

  if (achievedGoals.length > 0) {
    return {
      success: true,
      message: `Goal achieved: ${achievedGoals.join(", ")}! +200 XP`,
      status: "success",
      achievedGoals,
    };
  }

  return { success: true, message: "Measurement logged.", status: "success" };
}

export async function deleteMeasurementAction(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const measurementId = String(formData.get("measurement_id") ?? "").trim();
  if (!measurementId) {
    return { error: "Missing measurement id" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("body_measurements")
    .delete()
    .eq("id", measurementId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting measurement:", error);
    return { error: "Failed to delete measurement" };
  }

  revalidatePath("/profile");
  return { success: true, message: "Measurement deleted.", status: "success" };
}
