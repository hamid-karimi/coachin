import { UtensilsCrossed } from "lucide-react";
import { kcalText, mealGroups, type Meal } from "../lib/nutrition";
import { MealRow } from "./meal-row";

/** Today's meals by type, or the empty state. */
export function MealGroups({ meals }: { meals: Meal[] }) {
  if (meals.length === 0) {
    return (
      <div className='border-border flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center'>
        <UtensilsCrossed className='text-muted-foreground size-5' aria-hidden />
        <p className='text-foreground text-sm font-medium'>Nothing logged today</p>
        <p className='text-muted-foreground text-xs'>Each of your first 3 meals a day earns +5 XP.</p>
      </div>
    );
  }
  return mealGroups(meals).map((group) => (
    <section key={group.type} className='space-y-2'>
      <h2 className='text-overline flex items-center justify-between'>
        <span>{group.label}</span>
        <span className='text-muted-foreground normal-case'>{kcalText(group.kcal)} kcal</span>
      </h2>
      <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
        {group.meals.map((meal) => (
          <MealRow key={meal.id} meal={meal} />
        ))}
      </div>
    </section>
  ));
}
