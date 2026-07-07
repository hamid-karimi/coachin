"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { planWeekOf } from "@/lib/dates";
import type { PlanItemDetails } from "@/lib/plan-items";
import { buildScheduleInserts } from "@/lib/schedule-inserts";

export type PlanWeekItem = {
  id: string;
  day_of_week: number;
  item_type: string;
  title: string;
  description: string | null;
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

    // A user may hold several active plans (one per discipline). This view
    // shows one plan-week's items beside the manual routine; take the most
    // recent active plan without erroring on multiple rows. (Blending every
    // active plan here is a possible future enhancement — see /training.)
    const { data: plan } = await supabase
      .from("training_plans")
      .select("id, created_at, weeks_total")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!plan) return [];

    const week = planWeekOf(plan.created_at, plan.weeks_total);
    const { data: items } = await supabase
      .from("plan_items")
      .select("id, day_of_week, item_type, title, description, details, is_completed")
      .eq("plan_id", plan.id)
      .eq("week", week)
      .order("day_of_week");

    return (items ?? []) as PlanWeekItem[];
  } catch (err) {
    console.error("Error fetching current plan week items:", err);
    return [];
  }
}

// Save one sport across one or more days in a single insert. Reads a sport plus
// repeated `day_of_week` values, fans them out via the pure helper, and inserts
// every row at once.
export async function addScheduleSessions(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "User is not signed in." };
    }

    const sportId = formData.get("sport_type_id");
    const days = formData.getAll("day_of_week").map((d) => Number(d));
    const time = formData.get("time"); // HH:MM
    const endsOnRaw = String(formData.get("ends_on") ?? "").trim();

    if (!sportId || days.length === 0) {
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

    const rows = buildScheduleInserts({
      userId: user.id,
      sportTypeId: Number(sportId),
      days,
      time: time ? String(time) : null,
      endsOn,
    });

    if (rows.length === 0) {
      return { error: "Please pick at least one day." };
    }

    const { error } = await supabase.from("schedules").insert(rows);

    if (error) {
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

    revalidatePath("/onboarding");
    const count = rows.length;
    return {
      success: true,
      message: `${count} session${count === 1 ? "" : "s"} added to your schedule.`,
    };
  } catch (err) {
    console.error("❌ Unexpected error adding schedule sessions:", err);
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

// Every surface that shows quota progress (see plans/weekly-commitments.md).
const QUOTA_PATHS = ["/onboarding", "/dashboard", "/calendar"] as const;

function revalidateQuotaPaths() {
  for (const path of QUOTA_PATHS) revalidatePath(path);
}

// Fetch current user's weekly quotas (sport × N sessions/week targets)
export async function getWeeklyQuotas() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User is not signed in");
    }

    const { data, error } = await supabase
      .from("weekly_quotas")
      .select("*, sport_types(name)")
      .eq("user_id", user.id)
      .order("created_at");

    if (error) throw new Error(error.message);
    return data || [];
  } catch (err) {
    console.error("Error fetching weekly quotas:", err);
    return [];
  }
}

// Add (or update — upsert on the user+sport unique pair) one weekly quota
export async function addWeeklyQuota(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "User is not signed in." };
    }

    const sportId = Number(formData.get("sport_type_id"));
    const sessionsPerWeek = Number(formData.get("sessions_per_week"));

    if (!Number.isInteger(sportId) || sportId <= 0) {
      return { error: "Please pick a sport." };
    }
    if (
      !Number.isInteger(sessionsPerWeek) ||
      sessionsPerWeek < 1 ||
      sessionsPerWeek > 14
    ) {
      return { error: "Sessions per week must be between 1 and 14." };
    }

    const { data: sport } = await supabase
      .from("sport_types")
      .select("id")
      .eq("id", sportId)
      .maybeSingle();

    if (!sport) {
      return { error: "Unknown sport. Please pick one from the list." };
    }

    const { error } = await supabase.from("weekly_quotas").upsert(
      {
        user_id: user.id,
        sport_type_id: sportId,
        sessions_per_week: sessionsPerWeek,
      },
      { onConflict: "user_id,sport_type_id" },
    );

    if (error) {
      console.error("Error saving weekly quota:", error);
      return { error: "Failed to save the weekly target. Please try again." };
    }

    revalidateQuotaPaths();
    return { success: true, message: "Weekly target saved." };
  } catch (err) {
    console.error("Unexpected error saving weekly quota:", err);
    return {
      error: `Unexpected error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}

// Delete one weekly quota (scoped to the signed-in user)
export async function deleteWeeklyQuota(
  _prevState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  try {
    const quotaId = formData.get("quotaId") as string;

    if (!quotaId) {
      return { error: "Weekly target ID is missing." };
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "User is not signed in." };
    }

    const { error } = await supabase
      .from("weekly_quotas")
      .delete()
      .eq("id", quotaId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting weekly quota:", error);
      return { error: "Failed to remove the weekly target." };
    }

    revalidateQuotaPaths();
    return { success: true, message: "Weekly target removed." };
  } catch (err) {
    console.error("Unexpected error deleting weekly quota:", err);
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
