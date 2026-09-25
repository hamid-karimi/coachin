"use client";

import { useReducer, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useGenerateMealPlan } from "../hooks/use-meal-plan";
import { DIETS, INITIAL_PLAN_DRAFT, PLAN_GOALS, planDraftReducer, planIntakeBody } from "../lib/meal-plan";

const CHIP = "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors";
const CHIP_ON = "bg-brand text-brand-foreground";
const CHIP_OFF = "bg-secondary text-muted-foreground hover:text-foreground";

/** The meal-plan wizard: goal, diet, meals a day, allergies, dislikes. */
export function MealPlanIntake({ hasTrainingPlan }: { hasTrainingPlan: boolean }) {
  const [draft, dispatch] = useReducer(planDraftReducer, INITIAL_PLAN_DRAFT);
  const [suggestDismissed, setSuggestDismissed] = useState(false);
  const generate = useGenerateMealPlan();

  return (
    <div className='space-y-4'>
      {!hasTrainingPlan && !suggestDismissed && (
        <div className='border-border bg-secondary/50 flex items-start justify-between gap-3 rounded-xl border p-3'>
          <p className='text-muted-foreground text-sm'>
            For a menu that matches your training load,{" "}
            <Link href='/training/new' className='text-brand-ink font-medium'>
              build a training plan first
            </Link>
            . You can still generate one now from your body metrics.
          </p>
          <button
            type='button'
            aria-label='Dismiss'
            onClick={() => setSuggestDismissed(true)}
            className='text-muted-foreground hover:text-foreground shrink-0'>
            <X className='size-4' aria-hidden />
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate.mutate({ body: planIntakeBody(draft) });
        }}
        className='bg-card border-border space-y-5 rounded-xl border p-4'>
        <div className='space-y-2'>
          <Label>Goal</Label>
          <div className='flex flex-wrap gap-1.5'>
            {PLAN_GOALS.map(({ value, label }) => (
              <button
                key={value}
                type='button'
                aria-pressed={draft.goal === value}
                onClick={() => dispatch({ field: "goal", value })}
                className={cn(CHIP, draft.goal === value ? CHIP_ON : CHIP_OFF)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className='flex flex-wrap gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='diet'>Diet</Label>
            <select
              id='diet'
              value={draft.diet}
              onChange={(e) => dispatch({ field: "diet", value: e.target.value })}
              className='border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/25 h-11 rounded-md border px-3 text-sm capitalize outline-none focus-visible:ring-[3px]'>
              {DIETS.map((diet) => (
                <option key={diet} value={diet}>
                  {diet}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label>Meals / day</Label>
            <div className='flex gap-1.5'>
              {([3, 4] as const).map((count) => (
                <button
                  key={count}
                  type='button'
                  aria-pressed={draft.mealsPerDay === count}
                  onClick={() => dispatch({ field: "mealsPerDay", value: count })}
                  className={cn(
                    "h-11 w-11 rounded-md text-sm font-semibold transition-colors",
                    draft.mealsPerDay === count ? CHIP_ON : CHIP_OFF,
                  )}>
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='allergies'>Allergies (comma-separated)</Label>
          <Input
            id='allergies'
            placeholder='peanuts, shellfish'
            value={draft.allergies}
            onChange={(e) => dispatch({ field: "allergies", value: e.target.value })}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='dislikes'>Foods to avoid (comma-separated)</Label>
          <Input
            id='dislikes'
            placeholder='mushrooms, olives'
            value={draft.dislikes}
            onChange={(e) => dispatch({ field: "dislikes", value: e.target.value })}
          />
        </div>
        <Button type='submit' variant='brand' size='lg' disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Sparkles aria-hidden />}
          {generate.isPending ? "Generating your week…" : "Generate meal plan"}
        </Button>
        <p className='text-muted-foreground text-xs'>
          We size daily calories and macros from your height, weight, age, and weekly training days, then build a 7-day
          menu to match.
        </p>
      </form>
    </div>
  );
}
