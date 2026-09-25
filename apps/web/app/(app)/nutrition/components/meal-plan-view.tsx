import { planDays, type MealPlan, type MealPlanPage } from "../lib/meal-plan";
import { MealPlanActions } from "./meal-plan-actions";
import { PlannedMealCard } from "./planned-meal-card";

/** The active plan: daily targets, the week's menu, the grocery list, actions. */
export function MealPlanView({ plan, grocery }: { plan: MealPlan; grocery: MealPlanPage["grocery"] }) {
  const t = plan.targets;
  return (
    <div className='space-y-5'>
      <div className='bg-card border-border space-y-1 rounded-2xl border p-4'>
        <div className='flex items-baseline justify-between'>
          <p className='text-foreground text-sm font-semibold'>Daily target</p>
          <p className='text-stat text-brand-ink text-xl'>
            {Math.round(t.kcal).toLocaleString("en-US")}
            <span className='text-muted-foreground font-sans text-sm font-medium'> kcal</span>
          </p>
        </div>
        <p className='text-muted-foreground text-xs'>
          {Math.round(t.proteinG)}g protein · {Math.round(t.carbsG)}g carbs · {Math.round(t.fatG)}g fat
        </p>
      </div>
      <div className='border-border divide-border flex flex-col divide-y rounded-xl border'>
        {planDays(plan.meals).map(({ day, meals }) => (
          <div key={day.id} className='flex flex-col gap-2.5 p-3 sm:flex-row sm:gap-4 sm:p-4'>
            <div className='sm:w-24 sm:shrink-0 sm:pt-1'>
              <span className='text-foreground text-sm font-bold sm:text-base'>{day.short}</span>
              <span className='text-muted-foreground hidden text-xs sm:block'>{day.name}</span>
            </div>
            <div className='flex flex-1 flex-col gap-2'>
              {meals.map((meal) => (
                <PlannedMealCard key={meal.id} meal={meal} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {grocery.length > 0 && (
        <section className='space-y-2'>
          <h2 className='text-overline'>Grocery list</h2>
          <div className='bg-card border-border grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border p-4 sm:grid-cols-3'>
            {grocery.map((line) => (
              <p key={line.name} className='text-foreground text-sm'>
                {line.name}
                {line.count > 1 && <span className='text-muted-foreground text-xs'> ×{line.count}</span>}
              </p>
            ))}
          </div>
        </section>
      )}
      <MealPlanActions />
    </div>
  );
}
