"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

    if (!sportId || !dayOfWeek) {
      return { error: "Please fill in all required fields." };
    }

    const insertData = {
      user_id: user.id,
      sport_type_id: Number(sportId),
      day_of_week: Number(dayOfWeek),
      time: time ? String(time) : null,
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
