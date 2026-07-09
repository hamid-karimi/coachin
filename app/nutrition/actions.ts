"use server";

import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  estimateMealFromPhoto,
  type MealEstimateItem,
} from "@/lib/ai/nutrition";

export type NutritionActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: "success" | "info" | "error";
  /** Photo-estimate items pending user review (never auto-saved). */
  estimate?: MealEstimateItem[];
};

const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);

function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type AwardOutcome = { xp: number; capped: boolean; adherence: number };

/** Award meal XP for a log + lazily settle yesterday's adherence bonus. */
async function awardForMeal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mealLogId: string,
): Promise<AwardOutcome> {
  const outcome: AwardOutcome = { xp: 0, capped: false, adherence: 0 };

  const { data: mealAward } = await supabase.rpc("award_meal_xp", {
    p_meal_log_id: mealLogId,
  });
  if (mealAward?.success) {
    outcome.xp = Number(mealAward.awarded_xp) || 0;
    outcome.capped = Boolean(mealAward.capped);
  }

  const { data: adherence } = await supabase.rpc("award_day_adherence", {
    p_date: localDate(-1),
  });
  if (adherence?.success) {
    outcome.adherence = Number(adherence.awarded_xp) || 0;
  }

  return outcome;
}

function awardMessage(base: string, outcome: AwardOutcome): string {
  const parts = [base];
  if (outcome.xp > 0) parts.push(`+${outcome.xp} XP`);
  else if (outcome.capped) parts.push("daily meal XP cap reached");
  if (outcome.adherence > 0) {
    parts.push(`+${outcome.adherence} XP for hitting yesterday's calorie goal`);
  }
  return `${parts.join(" · ")}.`;
}

/**
 * Log a meal from local food search (food_id + quantity), a USDA candidate
 * (usda_json + quantity), or manual entry (name + kcal).
 */
export async function logMealAction(
  _prevState: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const mealType = String(formData.get("meal_type") ?? "").trim();
  if (!MEAL_TYPES.has(mealType)) return { error: "Pick a meal type" };

  const supabase = await createClient();
  const foodId = String(formData.get("food_id") ?? "").trim();
  const usdaJson = String(formData.get("usda_json") ?? "").trim();
  const quantity = Number(formData.get("quantity_g"));

  let insert: Record<string, unknown> | null = null;

  if (foodId) {
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) {
      return { error: "Enter the amount in grams" };
    }
    const { data: food } = await supabase
      .from("foods")
      .select(
        "id, name, kcal_per_100g, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg",
      )
      .eq("id", foodId)
      .single();
    if (!food) return { error: "Food not found" };
    const factor = quantity / 100;
    insert = {
      food_id: food.id,
      free_text: food.name,
      quantity_g: quantity,
      kcal: Math.round(food.kcal_per_100g * factor),
      protein_g: Math.round(food.protein_g * factor * 10) / 10,
      carbs_g: Math.round(food.carbs_g * factor * 10) / 10,
      fat_g: Math.round(food.fat_g * factor * 10) / 10,
      sugar_g: Math.round((Number(food.sugar_g) || 0) * factor * 10) / 10,
      fiber_g: Math.round((Number(food.fiber_g) || 0) * factor * 10) / 10,
      sodium_mg: Math.round((Number(food.sodium_mg) || 0) * factor),
      entry_method: "search",
    };
  } else if (usdaJson) {
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 5000) {
      return { error: "Enter the amount in grams" };
    }
    let candidate: {
      name?: string;
      kcal_per_100g?: number;
      protein_g?: number;
      carbs_g?: number;
      fat_g?: number;
      sugar_g?: number;
      fiber_g?: number;
      sodium_mg?: number;
    };
    try {
      candidate = JSON.parse(usdaJson);
    } catch {
      return { error: "Invalid USDA item" };
    }
    const kcal100 = Number(candidate.kcal_per_100g);
    if (!candidate.name || !Number.isFinite(kcal100) || kcal100 < 0) {
      return { error: "Invalid USDA item" };
    }
    // Backfill into the local foods table for future searches.
    const { data: food, error: foodError } = await supabase
      .from("foods")
      .insert({
        name: String(candidate.name).slice(0, 200),
        kcal_per_100g: kcal100,
        protein_g: Math.max(0, Number(candidate.protein_g) || 0),
        carbs_g: Math.max(0, Number(candidate.carbs_g) || 0),
        fat_g: Math.max(0, Number(candidate.fat_g) || 0),
        sugar_g: Math.max(0, Number(candidate.sugar_g) || 0),
        fiber_g: Math.max(0, Number(candidate.fiber_g) || 0),
        sodium_mg: Math.max(0, Number(candidate.sodium_mg) || 0),
        source: "usda",
        created_by: user.id,
      })
      .select(
        "id, name, kcal_per_100g, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg",
      )
      .single();
    if (foodError || !food) {
      console.error("USDA food insert failed:", foodError);
      return { error: "Failed to save the USDA food" };
    }
    const factor = quantity / 100;
    insert = {
      food_id: food.id,
      free_text: food.name,
      quantity_g: quantity,
      kcal: Math.round(food.kcal_per_100g * factor),
      protein_g: Math.round(food.protein_g * factor * 10) / 10,
      carbs_g: Math.round(food.carbs_g * factor * 10) / 10,
      fat_g: Math.round(food.fat_g * factor * 10) / 10,
      sugar_g: Math.round((Number(food.sugar_g) || 0) * factor * 10) / 10,
      fiber_g: Math.round((Number(food.fiber_g) || 0) * factor * 10) / 10,
      sodium_mg: Math.round((Number(food.sodium_mg) || 0) * factor),
      entry_method: "search",
    };
  } else {
    // Manual entry
    const name = String(formData.get("manual_name") ?? "").trim();
    const kcal = Number(formData.get("manual_kcal"));
    if (!name) return { error: "Name the food or pick one from search" };
    if (!Number.isFinite(kcal) || kcal <= 0 || kcal > 5000) {
      return { error: "Enter the calories (1-5000)" };
    }
    insert = {
      free_text: name.slice(0, 200),
      kcal: Math.round(kcal),
      protein_g: Math.max(0, Number(formData.get("manual_protein")) || 0),
      carbs_g: Math.max(0, Number(formData.get("manual_carbs")) || 0),
      fat_g: Math.max(0, Number(formData.get("manual_fat")) || 0),
      entry_method: "manual",
    };
  }

  const { data: log, error } = await supabase
    .from("meal_logs")
    .insert({ ...insert, user_id: user.id, meal_type: mealType })
    .select("id")
    .single();

  if (error || !log) {
    console.error("meal log insert failed:", error);
    return { error: "Failed to log the meal" };
  }

  const outcome = await awardForMeal(supabase, log.id);
  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return {
    success: true,
    status: "success",
    message: awardMessage("Meal logged", outcome),
  };
}

/** Photo → AI estimate. Returned for review; nothing is persisted here. */
export async function estimateMealPhotoAction(
  _prevState: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const photos = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
    .slice(0, 3);
  if (photos.length === 0) {
    return { error: "Choose a meal photo" };
  }
  for (const photo of photos) {
    if (photo.size > 2 * 1024 * 1024) {
      return {
        error: "Each photo must be under 2MB (they should be pre-compressed)",
      };
    }
  }
  const context =
    String(formData.get("context") ?? "").trim().slice(0, 140) || null;

  const images = await Promise.all(
    photos.map(async (photo) => ({
      base64: Buffer.from(await photo.arrayBuffer()).toString("base64"),
      mimeType: photo.type || "image/jpeg",
    })),
  );
  const estimate = await estimateMealFromPhoto({ images, context });
  if ("error" in estimate) return { error: estimate.error };
  if (estimate.length === 0) {
    return { error: "Couldn't recognize food in that photo — try another angle" };
  }

  return {
    success: true,
    status: "info",
    message: "Estimate ready — review and adjust before saving.",
    estimate,
  };
}

/** Persist reviewed photo-estimate items as meal logs. */
export async function confirmPhotoMealsAction(
  _prevState: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const mealType = String(formData.get("meal_type") ?? "").trim();
  if (!MEAL_TYPES.has(mealType)) return { error: "Pick a meal type" };

  let items: MealEstimateItem[];
  try {
    items = JSON.parse(String(formData.get("items_json") ?? "[]"));
  } catch {
    return { error: "Invalid items" };
  }
  items = (Array.isArray(items) ? items : []).slice(0, 10).filter(
    (item) =>
      item &&
      typeof item.name === "string" &&
      Number.isFinite(Number(item.est_kcal)) &&
      Number(item.est_kcal) > 0 &&
      Number(item.est_kcal) <= 5000,
  );
  if (items.length === 0) return { error: "Nothing to save" };

  const supabase = await createClient();
  const outcome: AwardOutcome = { xp: 0, capped: false, adherence: 0 };

  for (const item of items) {
    const { data: log, error } = await supabase
      .from("meal_logs")
      .insert({
        user_id: user.id,
        meal_type: mealType,
        free_text: item.name.slice(0, 200),
        quantity_g: Number(item.est_quantity_g) || null,
        kcal: Math.round(Number(item.est_kcal)),
        protein_g: Math.max(0, Number(item.protein_g) || 0),
        carbs_g: Math.max(0, Number(item.carbs_g) || 0),
        fat_g: Math.max(0, Number(item.fat_g) || 0),
        sugar_g: Math.max(0, Number(item.sugar_g) || 0),
        fiber_g: Math.max(0, Number(item.fiber_g) || 0),
        sodium_mg: Math.max(0, Number(item.sodium_mg) || 0),
        // Items added via food search in the review step are search-logged, not
        // photo-detected; only true photo estimates keep the photo snapshot.
        entry_method: item.source === "search" ? "search" : "photo",
        photo_estimate: item.source === "search" ? null : item,
      })
      .select("id")
      .single();
    if (error || !log) {
      console.error("photo meal insert failed:", error);
      continue;
    }
    const award = await awardForMeal(supabase, log.id);
    outcome.xp += award.xp;
    outcome.capped = outcome.capped || award.capped;
    outcome.adherence = Math.max(outcome.adherence, award.adherence);
  }

  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return {
    success: true,
    status: "success",
    message: awardMessage(
      `${items.length} ${items.length === 1 ? "item" : "items"} logged`,
      outcome,
    ),
  };
}

export async function deleteMealLogAction(
  _prevState: NutritionActionState,
  formData: FormData,
): Promise<NutritionActionState> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in" };

  const logId = String(formData.get("log_id") ?? "").trim();
  if (!logId) return { error: "Missing log id" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_logs")
    .delete()
    .eq("id", logId)
    .eq("user_id", user.id);

  if (error) {
    console.error("meal log delete failed:", error);
    return { error: "Failed to delete" };
  }

  revalidatePath("/nutrition");
  revalidatePath("/dashboard");
  return { success: true, message: "Meal removed.", status: "info" };
}
