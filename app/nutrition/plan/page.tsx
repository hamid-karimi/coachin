import { redirect } from "next/navigation";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { AppShell } from "@/components/design-system/app-shell";
import { MealPlanIntake } from "../components/meal-plan-intake";
import { MealPlanView, type MealPlanItem } from "../components/meal-plan-view";

export const dynamic = "force-dynamic";

export default async function MealPlanPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login");

  const supabase = await createClient();
  const [{ data: profile }, { data: plan }, { data: trainingPlan }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("meal_plans")
        .select(
          "id, kcal_target, protein_g_target, carbs_g_target, fat_g_target, intake",
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("training_plans")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle(),
    ]);

  let items: MealPlanItem[] = [];
  if (plan) {
    const { data } = await supabase
      .from("meal_plan_items")
      .select(
        "id, day_of_week, meal_type, title, ingredients, recipe, video_query, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg",
      )
      .eq("plan_id", plan.id)
      .order("day_of_week")
      .order("sort");
    items = (data ?? []) as MealPlanItem[];
  }

  return (
    <AppShell coachNav={canCoach(profile?.role)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
            Meal plan
          </h1>
          <p className="text-muted-foreground text-sm">
            An AI weekly menu built from your body metrics and training load.
          </p>
        </div>

        {plan ? (
          <MealPlanView
            targets={{
              kcal: Number(plan.kcal_target),
              protein_g: Number(plan.protein_g_target),
              carbs_g: Number(plan.carbs_g_target),
              fat_g: Number(plan.fat_g_target),
            }}
            intake={
              (plan.intake ?? {}) as Record<string, unknown>
            }
            items={items}
          />
        ) : (
          <MealPlanIntake hasTrainingPlan={Boolean(trainingPlan)} />
        )}
      </div>
    </AppShell>
  );
}
