"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import { yearsSince } from "@/lib/dates";
import { resolveUserCountry } from "@/lib/user-country";
import {
  computeTargets,
  type NutritionGoal,
} from "@/lib/nutrition-targets";
import { generateMealPlan, type MealPlanIntake } from "@/lib/ai/meal-plan";

export type MealPlanActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
  redirect?: string;
};

const GOALS = new Set<NutritionGoal>(["lose", "maintain", "gain", "recomp"]);

/** Comma-separated free text → a clean, capped string array. */
function parseList(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Point the active calorie-intake goal at the plan's target (best-effort). */
async function syncCalorieGoal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  kcal: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from("goals")
    .select("id")
    .eq("user_id", userId)
    .eq("goal_type", "calorie_intake")
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("goals")
      .update({ target_value: kcal })
      .eq("id", existing.id);
  } else {
    await supabase.from("goals").insert({
      user_id: userId,
      goal_type: "calorie_intake",
      target_value: kcal,
      status: "active",
    });
  }
}

export async function generateMealPlanAction(
  _prevState: MealPlanActionState,
  formData: FormData,
): Promise<MealPlanActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const goal = String(formData.get("goal") ?? "maintain") as NutritionGoal;
  if (!GOALS.has(goal)) return { error: "Pick a goal" };
  const diet = String(formData.get("diet") ?? "omnivore").slice(0, 40);
  const allergies = parseList(formData.get("allergies"));
  const dislikes = parseList(formData.get("dislikes"));
  const mealsPerDay = Number(formData.get("meals_per_day")) === 4 ? 4 : 3;

  const supabase = await createClient();

  const [{ data: profile }, { data: schedules }, { data: analyzedPhoto }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("sex, birth_date, height_cm, weight_kg, country")
        .eq("id", user.id)
        .single(),
      supabase
        .from("schedules")
        .select("day_of_week")
        .eq("user_id", user.id),
      supabase
        .from("body_photos")
        .select("analysis")
        .eq("user_id", user.id)
        .not("analysis", "is", null)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!profile) return { error: "Profile not found" };

  const trainingDaysPerWeek =
    new Set((schedules ?? []).map((s) => s.day_of_week)).size || 3;

  const targets = computeTargets({
    sex: profile.sex,
    age: yearsSince(profile.birth_date),
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    trainingDaysPerWeek,
    goal,
  });
  if (!targets) {
    return {
      error:
        "Add your height, weight, and birth date on your profile so we can size your targets.",
    };
  }

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

  // Profile country wins; Vercel's IP-geo header is only a fallback hint.
  const country = resolveUserCountry(
    profile.country,
    (await headers()).get("x-vercel-ip-country"),
  );

  const intake: MealPlanIntake = {
    goal,
    diet,
    allergies,
    dislikes,
    meals_per_day: mealsPerDay,
    targets,
    body_analysis: bodyAnalysis,
    country,
  };

  const generated = await generateMealPlan(intake);
  if ("error" in generated) return { error: generated.error };
  if (generated.length === 0) {
    return { error: "Couldn't generate a plan — try again." };
  }

  // Archive any current plan, then insert the new active one.
  await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      status: "active",
      intake: { goal, diet, allergies, dislikes, meals_per_day: mealsPerDay },
      kcal_target: targets.kcal,
      protein_g_target: targets.protein_g,
      carbs_g_target: targets.carbs_g,
      fat_g_target: targets.fat_g,
    })
    .select("id")
    .single();

  if (planError || !plan) {
    console.error("meal plan insert failed:", planError);
    return { error: "Failed to save the plan" };
  }

  const rows = generated.map((item, index) => ({
    plan_id: plan.id,
    user_id: user.id,
    day_of_week: item.day_of_week,
    meal_type: item.meal_type,
    title: item.title,
    ingredients: item.ingredients,
    recipe: item.recipe,
    video_query: item.video_query,
    kcal: item.kcal,
    protein_g: item.protein_g,
    carbs_g: item.carbs_g,
    fat_g: item.fat_g,
    sugar_g: item.sugar_g,
    fiber_g: item.fiber_g,
    sodium_mg: item.sodium_mg,
    sort: index,
  }));

  const { error: itemsError } = await supabase
    .from("meal_plan_items")
    .insert(rows);
  if (itemsError) {
    console.error("meal plan items insert failed:", itemsError);
    return { error: "Failed to save the plan's meals" };
  }

  await syncCalorieGoal(supabase, user.id, targets.kcal);

  revalidatePath("/nutrition/plan");
  revalidatePath("/nutrition");
  return {
    success: true,
    status: "success",
    message: "Meal plan ready — your calorie goal is set to match.",
    redirect: "/nutrition/plan",
  };
}

export async function discardMealPlanAction(): Promise<MealPlanActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "archived" })
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) {
    console.error("meal plan discard failed:", error);
    return { error: "Failed to discard the plan" };
  }

  revalidatePath("/nutrition/plan");
  return { success: true, status: "info", message: "Meal plan discarded." };
}
