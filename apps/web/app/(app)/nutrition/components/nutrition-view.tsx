"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
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
      <div className='flex items-start justify-between gap-3'>
        <div>
          <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>Nutrition</h1>
          <p className='text-muted-foreground text-sm'>
            Log meals by search, photo, or hand — earn XP for the habit and a bonus for hitting your calorie goal.
          </p>
        </div>
        <Link
          href='/nutrition/plan'
          className='bg-brand-tint text-brand-ink hover:bg-brand-tint/70 inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors'>
          <Sparkles className='size-3.5' aria-hidden />
          Meal plan
        </Link>
      </div>
      <DaySummary day={day} />
      <MealLogger usdaEnabled={day.usdaEnabled} />
      <MealGroups meals={day.meals} />
      <NutritionTrends day={day} />
    </div>
  );
}
