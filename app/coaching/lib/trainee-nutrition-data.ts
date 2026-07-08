import type { createClient } from "@/lib/supabase/server";
import { toLocalYMD } from "@/lib/dates";

export type TraineeMealRow = {
  id: string;
  date: string;
  meal_type: string;
  label: string;
  kcal: number;
  protein_g: number;
};

export type TraineeNutritionDay = {
  date: string;
  meals: TraineeMealRow[];
  totalKcal: number;
  totalProteinG: number;
};

export type TraineeNutritionData = {
  trainee: { id: string; name: string };
  sharingEnabled: boolean;
  /** Last 7 days with at least one meal log, newest first. */
  days: TraineeNutritionDay[];
  targets: { kcal: number | null; proteinG: number | null } | null;
};

const WINDOW_DAYS = 7;

/**
 * Coach view of a trainee's nutrition. Returns null when the trainee is not
 * actively coached by this coach (the page 404-redirects). The meal reads run
 * under the coach-read RLS policies (nutrition_coach_read migration): with
 * sharing off they return empty and the page shows the opt-in explainer.
 */
export async function getTraineeNutritionData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  coachId: string,
  traineeId: string,
): Promise<TraineeNutritionData | null> {
  const { data: relationship } = await supabase
    .from("coaching_relationships")
    .select("student:profiles(id, full_name, email)")
    .eq("coach_id", coachId)
    .eq("student_id", traineeId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // Supabase types to-one joins as arrays; the row is a single object.
  const student = relationship?.student as unknown as {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
  if (!student) return null;

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - (WINDOW_DAYS - 1));

  const [{ data: sharingRow }, { data: mealRows }, { data: planRow }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("nutrition_sharing_enabled")
        .eq("id", traineeId)
        .maybeSingle(),
      supabase
        .from("meal_logs")
        .select("id, date, meal_type, free_text, kcal, protein_g, food:foods(name)")
        .eq("user_id", traineeId)
        .gte("date", toLocalYMD(windowStart))
        .order("date", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("meal_plans")
        .select("kcal_target, protein_g_target")
        .eq("user_id", traineeId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
    ]);

  const meals: TraineeMealRow[] = ((mealRows ?? []) as unknown as {
    id: string;
    date: string;
    meal_type: string | null;
    free_text: string | null;
    kcal: number | null;
    protein_g: number | null;
    food: { name: string | null } | null;
  }[]).map((row) => ({
    id: row.id,
    date: row.date,
    meal_type: row.meal_type ?? "meal",
    label: row.food?.name || row.free_text || "Logged meal",
    kcal: Number(row.kcal ?? 0),
    protein_g: Number(row.protein_g ?? 0),
  }));

  const days: TraineeNutritionDay[] = [];
  for (const meal of meals) {
    const day = days.find((entry) => entry.date === meal.date);
    if (day) {
      day.meals.push(meal);
      day.totalKcal += meal.kcal;
      day.totalProteinG += meal.protein_g;
    } else {
      days.push({
        date: meal.date,
        meals: [meal],
        totalKcal: meal.kcal,
        totalProteinG: meal.protein_g,
      });
    }
  }

  return {
    trainee: {
      id: student.id,
      name: student.full_name || student.email || "Trainee",
    },
    sharingEnabled: Boolean(sharingRow?.nutrition_sharing_enabled),
    days,
    targets: planRow
      ? {
          kcal: planRow.kcal_target !== null ? Number(planRow.kcal_target) : null,
          proteinG:
            planRow.protein_g_target !== null
              ? Number(planRow.protein_g_target)
              : null,
        }
      : null,
  };
}
