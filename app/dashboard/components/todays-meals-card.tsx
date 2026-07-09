import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { PlannedMeal } from "@/app/nutrition/lib/meal-plan-day";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

interface TodaysMealsCardProps {
  meals: PlannedMeal[];
  kcalTarget: number | null;
}

/** Today's menu from the active AI meal plan — a read-only reminder card
 *  linking to the full plan. Rendered only when a plan exists. */
export function TodaysMealsCard({ meals, kcalTarget }: TodaysMealsCardProps) {
  const totalKcal = meals.reduce((sum, meal) => sum + meal.kcal, 0);

  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-foreground text-sm font-semibold">
          Today&apos;s meals
        </h2>
        <Link
          href="/nutrition/plan"
          className="text-brand-ink inline-flex items-center gap-0.5 text-[13px] font-medium hover:underline"
        >
          Full meal plan
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      {meals.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-[13px]">
          Nothing planned for today — see the full plan for the week.
        </p>
      ) : (
        <>
          <ul className="mt-2 space-y-1">
            {meals.map((meal) => (
              <li
                key={meal.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <p className="text-foreground min-w-0 truncate">
                  <span className="text-muted-foreground">
                    {MEAL_TYPE_LABELS[meal.meal_type] ?? "Meal"} ·{" "}
                  </span>
                  {meal.title}
                </p>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {Math.round(meal.kcal)} kcal
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            {Math.round(totalKcal).toLocaleString()} kcal planned
            {kcalTarget
              ? ` · target ${Math.round(kcalTarget).toLocaleString()}`
              : ""}
          </p>
        </>
      )}
    </div>
  );
}
