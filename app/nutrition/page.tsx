import Link from "next/link";
import { redirect } from "next/navigation";
import { Sparkles, UtensilsCrossed } from "lucide-react";

import { createClient, getUser } from "@/lib/supabase/server";
import { canCoach } from "@/lib/roles";
import { AppShell } from "@/components/design-system/app-shell";
import { Progress } from "@/components/ui/progress";
import { summarizePeriod, type DatedNutrients } from "@/lib/nutrition-trends";
import { MealLogger } from "./components/meal-logger";
import { MealRow, type MealLog } from "./components/meal-row";
import { NutritionTrends } from "./components/nutrition-trends";

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
  // 30-day window (inclusive) for the weekly/monthly trend rollups.
  const since = (() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const [
    { data: profile },
    { data: logs },
    { data: calorieGoal },
    { data: rangeLogs },
  ] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("meal_logs")
      .select(
        "id, meal_type, free_text, quantity_g, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, entry_method",
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
    supabase
      .from("meal_logs")
      .select(
        "date, kcal, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg",
      )
      .eq("user_id", user.id)
      .gte("date", since),
  ]);

  const meals = (logs ?? []) as MealLog[];
  const totals = meals.reduce(
    (sum, log) => ({
      kcal: sum.kcal + Number(log.kcal),
      protein: sum.protein + Number(log.protein_g),
      carbs: sum.carbs + Number(log.carbs_g),
      fat: sum.fat + Number(log.fat_g),
      sugar: sum.sugar + Number(log.sugar_g),
      fiber: sum.fiber + Number(log.fiber_g),
      sodium: sum.sodium + Number(log.sodium_mg),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 },
  );
  const target = calorieGoal?.target_value
    ? Number(calorieGoal.target_value)
    : null;
  const pct = target
    ? Math.min(100, Math.round((totals.kcal / target) * 100))
    : null;

  const trendRows = (rangeLogs ?? []) as DatedNutrients[];
  const weekSummary = summarizePeriod(trendRows, 7, today);
  const monthSummary = summarizePeriod(trendRows, 30, today);

  return (
    <AppShell coachNav={canCoach(profile?.role)}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]">
              Nutrition
            </h1>
            <p className="text-muted-foreground text-sm">
              Log meals by search, photo, or hand — earn XP for the habit and a
              bonus for hitting your calorie goal.
            </p>
          </div>
          <Link
            href="/nutrition/plan"
            className="bg-brand-tint text-brand-ink hover:bg-brand-tint/70 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            <Sparkles className="size-3.5" aria-hidden />
            Meal plan
          </Link>
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
          <p className="text-muted-foreground text-xs">
            {Math.round(totals.sugar)}g sugar · {Math.round(totals.fiber)}g
            fiber · {Math.round(totals.sodium)}mg sodium
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
            const typeKcal = typeLogs.reduce(
              (sum, log) => sum + Number(log.kcal),
              0,
            );
            return (
              <section key={type} className="space-y-2">
                <h2 className="text-overline flex items-center justify-between">
                  <span>{MEAL_LABELS[type]}</span>
                  <span className="text-muted-foreground normal-case">
                    {Math.round(typeKcal).toLocaleString()} kcal
                  </span>
                </h2>
                <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
                  {typeLogs.map((log) => (
                    <MealRow key={log.id} log={log} />
                  ))}
                </div>
              </section>
            );
          })
        )}

        <NutritionTrends
          week={weekSummary}
          month={monthSummary}
          target={target}
        />
      </div>
    </AppShell>
  );
}
