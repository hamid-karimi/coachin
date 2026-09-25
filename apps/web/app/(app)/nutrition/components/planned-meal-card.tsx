import { Play } from "lucide-react";
import { MEAL_TYPE_LABEL, mealVideoUrl, plannedMealLine, type PlannedMeal } from "../lib/meal-plan";

/** One planned meal: type, title, kcal, macros, recipe & ingredients, how-to video. */
export function PlannedMealCard({ meal }: { meal: PlannedMeal }) {
  const videoUrl = mealVideoUrl(meal);
  return (
    <div className='bg-secondary border-border rounded-lg border p-3'>
      <div className='flex items-baseline justify-between gap-3'>
        <p className='text-foreground text-sm font-semibold'>
          <span className='text-muted-foreground text-xs font-medium'>
            {MEAL_TYPE_LABEL[meal.mealType] ?? meal.mealType} ·{" "}
          </span>
          {meal.title}
        </p>
        <span className='text-brand-ink text-stat shrink-0 text-sm'>{Math.round(meal.nutrients.kcal)} kcal</span>
      </div>
      <p className='text-muted-foreground mt-0.5 text-xs'>{plannedMealLine(meal)}</p>
      {(meal.recipe || meal.ingredients.length > 0) && (
        <details className='mt-1.5'>
          <summary className='text-muted-foreground cursor-pointer text-xs select-none'>Recipe & ingredients</summary>
          {meal.ingredients.length > 0 && (
            <ul className='text-muted-foreground mt-1.5 list-disc space-y-0.5 pl-4 text-xs'>
              {meal.ingredients.map((ing, index) => (
                <li key={index}>
                  {ing.name}
                  {ing.qty ? ` — ${ing.qty}` : ""}
                </li>
              ))}
            </ul>
          )}
          {meal.recipe && <p className='text-muted-foreground mt-1.5 text-xs leading-relaxed'>{meal.recipe}</p>}
        </details>
      )}
      {videoUrl && (
        <a
          href={videoUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='text-brand-ink mt-1.5 inline-flex items-center gap-1 text-xs font-medium hover:underline'>
          <Play className='size-3' aria-hidden />
          Watch how
        </a>
      )}
    </div>
  );
}
