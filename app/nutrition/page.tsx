import { redirect } from "next/navigation";
import { UtensilsCrossed } from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { AppShell } from "@/components/design-system/app-shell";
import { Progress } from "@/components/ui/progress";
import { MealLogger } from "./components/meal-logger";
import { MealRow, type MealLog } from "./components/meal-row";

export const dynamic = "force-dynamic";

const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"] as const;
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

function localToday(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default async function NutritionPage() {
  const user = await getUser();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const today = localToday();

  const [{ data: profile }, { data: logs }, { data: calorieGoal }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("meal_logs")
        .select(
          "id, meal_type, free_text, quantity_g, kcal, protein_g, carbs_g, fat_g, entry_method",
        )
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at"),
      supabase
        .from("goals")
        .select("target_value")
        .eq("user_id", user.id)
        .eq("goal_type", "calorie_intake")
        .eq("status", "active")
        .maybeSingle(),
    ]);

  const meals = (logs ?? []) as (MealLog & {
    carbs_g: number;
    fat_g: number;
  })[];
  const totals = meals.reduce(
    (sum, log) => ({
      kcal: sum.kcal + Number(log.kcal),
      protein: sum.protein + Number(log.protein_g),
      carbs: sum.carbs + Number(log.carbs_g),
      fat: sum.fat + Number(log.fat_g),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const target = calorieGoal?.target_value
    ? Number(calorieGoal.target_value)
    : null;
  const pct = target
    ? Math.min(100, Math.round((totals.kcal / target) * 100))
    : null;

  return (
    <AppShell coachNav={canCoach(profile?.role)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div>
          <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
            Nutrition
          </h1>
          <p className="text-muted-foreground text-sm">
            Log meals by search, photo, or hand — earn XP for the habit and a
            bonus for hitting your calorie goal.
          </p>
        </div>

        {/* Day summary */}
        <div className="bg-card border-border space-y-2.5 rounded-2xl border p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-foreground text-sm font-semibold">Today</p>
            <p className="text-stat text-brand-ink text-xl">
              {Math.round(totals.kcal).toLocaleString()}
              <span className="text-muted-foreground font-sans text-sm font-medium">
                {" "}
                / {target ? target.toLocaleString() : "—"} kcal
              </span>
            </p>
          </div>
          {pct !== null ? (
            <Progress value={pct} />
          ) : (
            <p className="text-muted-foreground text-xs">
              Set a daily calorie-intake goal on your profile to track this bar
              and earn the +30 XP adherence bonus.
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            {Math.round(totals.protein)}g protein ·{" "}
            {Math.round(totals.carbs)}g carbs · {Math.round(totals.fat)}g fat
          </p>
        </div>

        <MealLogger hasUsda={Boolean(process.env.USDA_API_KEY)} />

        {/* Meals by type */}
        {meals.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center">
            <UtensilsCrossed
              className="text-muted-foreground size-5"
              aria-hidden
            />
            <p className="text-foreground text-sm font-medium">
              Nothing logged today
            </p>
            <p className="text-muted-foreground text-xs">
              Each of your first 3 meals a day earns +5 XP.
            </p>
          </div>
        ) : (
          MEAL_ORDER.map((type) => {
            const typeLogs = meals.filter((log) => log.meal_type === type);
            if (typeLogs.length === 0) return null;
            return (
              <section key={type} className="space-y-2">
                <h2 className="text-overline">{MEAL_LABELS[type]}</h2>
                <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
                  {typeLogs.map((log) => (
                    <MealRow key={log.id} log={log} />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
