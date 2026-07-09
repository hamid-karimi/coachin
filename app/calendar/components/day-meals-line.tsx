import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

import type { MealAdherence } from "@/lib/meal-adherence";

type DayMealsLineProps = {
  plannedCount: number;
  plannedKcal: number;
  /** Adherence for past/today days; null on future days (planned link only). */
  adherence: MealAdherence | null;
};

function adherenceText(adherence: MealAdherence): string {
  if (adherence.slotsLogged === 0) return "No meals logged";
  const slots = `${adherence.slotsLogged}/${adherence.slotsPlanned} meals logged`;
  if (adherence.kcalRatio === null) return slots;
  return `${slots} · ${Math.round(adherence.kcalRatio * 100)}% of plan kcal`;
}

/**
 * The active AI meal plan's per-day summary on a calendar cell: a link to the
 * plan, plus (on today/past days) a single muted adherence line comparing
 * logged meals to the plan. Presentational — dueness/adherence is computed in
 * the page via `mealAdherenceForDay`.
 */
export function DayMealsLine({
  plannedCount,
  plannedKcal,
  adherence,
}: DayMealsLineProps) {
  return (
    <div className="mt-2 flex flex-col gap-0.5">
      <Link
        href="/nutrition/plan"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors"
      >
        <UtensilsCrossed className="size-3" aria-hidden />
        {plannedCount} {plannedCount === 1 ? "meal" : "meals"} planned ·{" "}
        {Math.round(plannedKcal).toLocaleString()} kcal
      </Link>
      {adherence && (
        <p className="text-muted-foreground text-[11px]">
          {adherenceText(adherence)}
        </p>
      )}
    </div>
  );
}
