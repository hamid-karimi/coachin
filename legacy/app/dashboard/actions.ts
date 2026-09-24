"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type DashboardActionState = {
  error?: string;
  success?: boolean;
  earnedXp?: number;
  redirect?: string;
};

export async function logoutAction(): Promise<DashboardActionState> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Logout error:", error);
    return { error: error.message };
  }

  // No layout revalidation here: it would re-render the CURRENT page (e.g.
  // /profile) inside this response with a half-cleared session, which is a
  // guaranteed server error. Every authed page is dynamic and re-checks auth
  // per request, so the redirect alone is correct.
  redirect("/auth/login");
}

export async function logWorkout(
  _prevState: DashboardActionState,
  formData: FormData,
): Promise<DashboardActionState> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("No authenticated user found");
      return { error: "User is not signed in." };
    }

    if (process.env.NODE_ENV === "development") {
      console.log("✅ Authenticated user ID:", user.id);
    }

    // Get values from form
    const sportId = formData.get("sport_type_id");
    const duration = 60; // Default duration is 60 minutes
    const notes = formData.get("notes") as string;
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const date = `${year}-${month}-${day}`;

    if (!sportId) {
      return { error: "Please select a sport type." };
    }

    if (duration <= 0) {
      return { error: "Duration must be greater than zero." };
    }

    // 1) Fetch sport XP multiplier
    const { data: sport, error: sportError } = await supabase
      .from("sport_types")
      .select("xp_multiplier")
      .eq("id", sportId)
      .single();

    if (sportError || !sport) {
      console.error("Sport fetch error:", sportError);
      return { error: "Sport type not found." };
    }

    // 2) Calculate XP
    const earnedXp = Math.round(duration * sport.xp_multiplier);
    console.log("📊 Calculated XP:", {
      duration,
      multiplier: sport.xp_multiplier,
      earnedXp,
    });

    // 3) Insert workout log
    const logData = {
      user_id: user.id,
      sport_type_id: Number(sportId),
      date: date,
      status: "completed",
      notes: notes || null,
    };

    console.log("📝 Attempting to insert log:", logData);

    const { error: logError } = await supabase.from("logs").insert(logData);

    if (logError) {
      console.error("❌ Error logging workout:", logError);
      console.error("Error code:", logError.code);
      console.error("Error message:", logError.message);
      console.error("Error details:", logError.details);

      if (logError.message.includes("row-level security")) {
        return {
          error:
            "Access denied: row-level security policy prevents logging this workout. Please review Supabase policies.",
        };
      }

      return { error: `Failed to log workout: ${logError.message}` };
    }

    console.log("✅ Workout log inserted successfully");

    // 4) Update profile XP and level
    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("xp, current_streak")
      .eq("id", user.id)
      .single();

    if (profileFetchError) {
      console.error("Profile fetch error:", profileFetchError);
      // Continue even if profile fetch fails
    }

    const currentXp = profile?.xp || 0;
    const newXp = currentXp + earnedXp;
    // Simple level formula: every 1000 XP = +1 level
    const newLevel = Math.floor(newXp / 1000) + 1;

    console.log("📈 Updating profile:", {
      currentXp,
      earnedXp,
      newXp,
      newLevel,
    });

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        xp: newXp,
        level: newLevel,
        // Streak logic can be handled by a scheduled job later.
        // For now, only XP/level are updated.
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("❌ Error updating profile:", updateError);
      console.error("Error code:", updateError.code);
      console.error("Error message:", updateError.message);

      if (updateError.message.includes("row-level security")) {
        return {
          error:
            "Profile update blocked by RLS. Workout was logged, but XP was not updated.",
        };
      }

      return {
        error: `Workout logged, but failed to update profile: ${updateError.message}`,
      };
    }

    const { error: xpTransactionError } = await supabase
      .from("xp_transactions")
      .insert({
        user_id: user.id,
        amount: earnedXp,
        reason: `workout_log:${sportId}`,
      });

    if (xpTransactionError) {
      console.error("❌ Error inserting xp transaction:", xpTransactionError);
      return {
        error: `Workout logged, but failed to write XP transaction: ${xpTransactionError.message}`,
      };
    }

    console.log("✅ Profile updated successfully");

    return { success: true, earnedXp };
  } catch (err) {
    console.error("❌ Unexpected error in logWorkout:", err);
    return {
      error: `Unexpected error: ${err instanceof Error ? err.message : "Unknown"}`,
    };
  }
}
