"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useDeleteMeal } from "../hooks/use-nutrition";
import { mealDetail, type Meal } from "../lib/nutrition";

/** A logged meal with its nutrients and a remove button (its meal XP is given back). */
export function MealRow({ meal }: { meal: Meal }) {
  const remove = useDeleteMeal();
  const name = meal.name ?? "Meal";
  return (
    <div className='flex items-center justify-between gap-3 py-2.5'>
      <div className='min-w-0'>
        <p className='text-foreground flex items-center gap-1.5 text-sm font-medium'>
          <span className='truncate'>{name}</span>
          {meal.entryMethod === "photo" && (
            <Camera className='text-muted-foreground size-3.5 shrink-0' aria-label='Logged from a photo' />
          )}
        </p>
        <p className='text-muted-foreground text-xs'>{mealDetail(meal)}</p>
      </div>
      <div className='flex shrink-0 items-center gap-2'>
        <span className='text-stat text-brand-ink text-sm'>{Math.round(meal.nutrients.kcal)} kcal</span>
        <button
          type='button'
          disabled={remove.isPending}
          aria-label={`Remove ${name}`}
          onClick={() => remove.mutate({ params: { path: { id: meal.id } } })}
          className='text-muted-foreground hover:bg-secondary hover:text-foreground grid size-6 place-items-center rounded-md transition-colors disabled:opacity-50'>
          {remove.isPending ? (
            <Loader2 className='size-3.5 animate-spin' aria-hidden />
          ) : (
            <X className='size-3.5' aria-hidden />
          )}
        </button>
      </div>
    </div>
  );
}
