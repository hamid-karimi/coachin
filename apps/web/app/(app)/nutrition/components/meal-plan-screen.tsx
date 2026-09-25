"use client";

import { useMealPlan } from "../hooks/use-meal-plan";
import { MealPlanIntake } from "./meal-plan-intake";
import { MealPlanView } from "./meal-plan-view";

/** /nutrition/plan: the active plan, or the wizard. */
export function MealPlanScreen() {
  const page = useMealPlan();
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5'>
      <div>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>Meal plan</h1>
        <p className='text-muted-foreground text-sm'>
          An AI weekly menu built from your body metrics and training load.
        </p>
      </div>
      {page.plan ? (
        <MealPlanView plan={page.plan} grocery={page.grocery} />
      ) : (
        <MealPlanIntake hasTrainingPlan={page.hasTrainingPlan} />
      )}
    </div>
  );
}
