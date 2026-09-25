"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MEAL_TYPE_LABEL, todaysMealsText } from "@/app/(app)/nutrition/lib/meal-plan";
import { useToday } from "../hooks/use-today";

/** Today's menu from the active AI meal plan — a read-only pointer to the full plan; hidden without one. */
export function TodaysMealsCard() {
  const { mealPlan } = useToday();
  if (!mealPlan) return null;
  return (
    <div className='bg-card border-border rounded-2xl border p-4'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-foreground text-sm font-semibold'>Today&apos;s meals</h2>
        <Link
          href='/nutrition/plan'
          className='text-brand-ink inline-flex items-center gap-0.5 text-[13px] font-medium hover:underline'>
          Full meal plan
          <ChevronRight className='size-3.5' aria-hidden />
        </Link>
      </div>
      {mealPlan.meals.length === 0 ? (
        <p className='text-muted-foreground mt-2 text-[13px]'>
          Nothing planned for today — see the full plan for the week.
        </p>
      ) : (
        <>
          <ul className='mt-2 space-y-1'>
            {mealPlan.meals.map((meal) => (
              <li key={meal.id} className='flex items-baseline justify-between gap-3 text-sm'>
                <p className='text-foreground min-w-0 truncate'>
                  <span className='text-muted-foreground'>{MEAL_TYPE_LABEL[meal.mealType] ?? "Meal"} · </span>
                  {meal.title}
                </p>
                <span className='text-muted-foreground shrink-0 text-xs'>{Math.round(meal.kcal)} kcal</span>
              </li>
            ))}
          </ul>
          <p className='text-muted-foreground mt-2 text-xs'>{todaysMealsText(mealPlan.meals, mealPlan.kcalTarget)}</p>
        </>
      )}
    </div>
  );
}
