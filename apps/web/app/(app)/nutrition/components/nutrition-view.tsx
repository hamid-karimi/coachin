"use client";

import { useNutritionDay } from "../hooks/use-nutrition";
import { DaySummary } from "./day-summary";
import { MealGroups } from "./meal-groups";
import { MealLogger } from "./meal-logger";
import { NutritionTrends } from "./nutrition-trends";

/** The nutrition page: day summary, logger, today's meals, trends. */
export function NutritionView() {
  const day = useNutritionDay();
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5'>
      <div>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>Nutrition</h1>
        <p className='text-muted-foreground text-sm'>
          Log meals by search, photo, or hand — earn XP for the habit and a bonus for hitting your calorie goal.
        </p>
      </div>
      <DaySummary day={day} />
      <MealLogger usdaEnabled={day.usdaEnabled} />
      <MealGroups meals={day.meals} />
      <NutritionTrends day={day} />
    </div>
  );
}
