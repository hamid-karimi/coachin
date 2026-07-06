"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { planWeekOf } from "@/lib/dates";
import type { PlanItemDetails } from "@/lib/plan-items";

export type PlanWeekItem = {
  id: string;
  day_of_week: number;
  item_type: string;
  title: string;
  is_completed: boolean;
  details: PlanItemDetails | null;
};

export type OnboardingActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
  redirect?: string;
};

// Fetch sport types for dropdown rendering
export async function getSportTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sport_types").select("*");

  if (error) throw new Error(error.message);
  return data;
}

// Fetch current user's schedules
export async function getUserSchedules() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User is not signed in");
    }

    const { data, error } = await supabase
      .from("schedules")
      .select("*, sport_types(name)")
      .eq("user_id", user.id);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err) {
    console.error("Error fetching user schedules:", err);
    return [];
  }
}

// Fetch the active AI plan's items for the CURRENT plan week, so onboarding
// can show today's (and this week's) generated training alongside the manual
// routine. Read-only here — the plan is edited from /training.
export async function getCurrentPlanWeekItems(): Promise<PlanWeekItem[]> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: plan } = await supabase
      .from("training_plans")
      .select("id, created_at, weeks_total")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (!plan) return [];

    const week = planWeekOf(plan.created_at, plan.weeks_total);
    const { data: items } = await supabase
      .from("plan_items")
      .select("id, day_of_week, item_type, title, details, is_completed")
      .eq("plan_id", plan.id)
      .eq("week", week)
      .order("day_of_week");

    return (items ?? []) as PlanWeekItem[];
  } catch (err) {
    console.error("Error fetching current plan week items:", err);
    return [];
  }
}

// Save one item in weekly schedule
export async function addScheduleItem(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("❌ No authenticated user found");
      return { error: "User is not signed in." };
    }

    console.log("✅ Authenticated user:", {
      id: user.id,
      email: user.email,
    });

    const sportId = formData.get("sport_type_id");
    const dayOfWeek = formData.get("day_of_week");
    const time = formData.get("time"); // HH:MM
    const endsOnRaw = String(formData.get("ends_on") ?? "").trim();

    if (!sportId || !dayOfWeek) {
      return { error: "Please fill in all required fields." };
    }

    let endsOn: string | null = null;
    if (endsOnRaw) {
      const parsed = new Date(`${endsOnRaw}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) {
        return { error: "Enter a valid 'repeat until' date." };
      }
      endsOn = endsOnRaw;
    }

    const insertData = {
      user_id: user.id,
      sport_type_id: Number(sportId),
      day_of_week: Number(dayOfWeek),
      time: time ? String(time) : null,
      ends_on: endsOn,
    };

    console.log("📝 Attempting to insert:", insertData);

    const { data, error } = await supabase.from("schedules").insert(insertData);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error details:", error.details);
      console.error("Error hint:", error.hint);

      // Check if it's an RLS policy error
      if (error.message.includes("row-level security")) {
        return {
          error:
            "Access denied: row-level security policy prevents inserting schedule items. Please review your Supabase policies.",
        };
      }

      return {
        error: `Failed to save schedule: ${error.message || "Unknown error"}. Please try again.`,
      };
    }

    console.log("✅ Schedule item inserted successfully:", data);
    revalidatePath("/onboarding");
    return { success: true, message: "Activity added to your schedule." };
  } catch (err) {
    console.error("❌ Unexpected error adding schedule:", err);
    return {
      error: `Unexpected error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// Delete one schedule item
export async function deleteScheduleItem(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const scheduleId = formData.get("scheduleId") as string;

    if (!scheduleId) {
      return { error: "Schedule ID is missing." };
    }

    const supabase = await createClient();

    // Confirm user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "User is not signed in." };
    }

    console.log("🗑️ Attempting to delete schedule:", {
      scheduleId,
      userId: user.id,
    });

    const { error } = await supabase
      .from("schedules")
      .delete()
      .eq("id", scheduleId);

    if (error) {
      console.error("❌ Error deleting schedule:", error);
      if (error.message.includes("row-level security")) {
        return {
          error:
            "Access denied: you are not allowed to delete this schedule item.",
        };
      }
      return { error: "Failed to delete the schedule item." };
    }

    console.log("✅ Schedule deleted successfully");
    revalidatePath("/onboarding");
    return { success: true, message: "Activity removed from your schedule." };
  } catch (err) {
    console.error("❌ Unexpected error deleting schedule:", err);
    return { error: "Unexpected error occurred." };
  }
}

// Finish onboarding and redirect to dashboard
export async function completeOnboarding(): Promise<OnboardingActionState> {
  return {
    success: true,
    message: "Onboarding completed successfully.",
    redirect: "/dashboard",
  };
}
