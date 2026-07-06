import { Play } from "lucide-react";

import { WEEK_DAYS } from "@/lib/week-days";
import { planItemVideoUrl } from "@/lib/plan-items";
import { buildGroceryList, type PlanIngredient } from "@/lib/meal-plan-grocery";
import type { NutritionTargets } from "@/lib/nutrition-targets";
import { MealPlanActions } from "./meal-plan-actions";

export interface MealPlanItem {
  id: string;
  day_of_week: number;
  meal_type: string;
  title: string;
  ingredients: PlanIngredient[] | null;
  recipe: string | null;
  video_query: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
}

const MEAL_LABEL: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function MealCard({ item }: { item: MealPlanItem }) {
  const videoUrl = planItemVideoUrl({ video_query: item.video_query ?? "" });
  return (
    <div className="bg-secondary border-border rounded-lg border p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground text-sm font-semibold">
          <span className="text-muted-foreground text-xs font-medium">
            {MEAL_LABEL[item.meal_type] ?? item.meal_type} ·{" "}
          </span>
          {item.title}
        </p>
        <span className="text-brand-ink text-stat shrink-0 text-sm">
          {Math.round(item.kcal)} kcal
        </span>
      </div>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {Math.round(item.protein_g)}P · {Math.round(item.carbs_g)}C ·{" "}
        {Math.round(item.fat_g)}F · {Math.round(item.sugar_g)}g sugar
      </p>
      {(item.recipe || (item.ingredients?.length ?? 0) > 0) && (
        <details className="mt-1.5">
          <summary className="text-muted-foreground cursor-pointer text-xs select-none">
            Recipe & ingredients
          </summary>
          {item.ingredients && item.ingredients.length > 0 && (
            <ul className="text-muted-foreground mt-1.5 list-disc space-y-0.5 pl-4 text-xs">
              {item.ingredients.map((ing, index) => (
                <li key={index}>
                  {ing.name}
                  {ing.qty ? ` — ${ing.qty}` : ""}
                </li>
              ))}
            </ul>
          )}
          {item.recipe && (
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              {item.recipe}
            </p>
          )}
        </details>
      )}
      {videoUrl && (
        <a
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-ink mt-1.5 inline-flex items-center gap-1 text-xs font-medium hover:underline"
        >
          <Play className="size-3" aria-hidden />
          Watch how
        </a>
      )}
    </div>
  );
}

export function MealPlanView({
  targets,
  intake,
  items,
}: {
  targets: NutritionTargets;
  intake: Record<string, unknown>;
  items: MealPlanItem[];
}) {
  const grocery = buildGroceryList(items);

  return (
    <div className="space-y-5">
      {/* Targets */}
      <div className="bg-card border-border space-y-1 rounded-2xl border p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-foreground text-sm font-semibold">Daily target</p>
          <p className="text-stat text-brand-ink text-xl">
            {targets.kcal.toLocaleString()}
            <span className="text-muted-foreground font-sans text-sm font-medium">
              {" "}
              kcal
            </span>
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          {targets.protein_g}g protein · {targets.carbs_g}g carbs ·{" "}
          {targets.fat_g}g fat
        </p>
      </div>

      {/* Week menu */}
      <div className="border-border divide-border flex flex-col divide-y rounded-xl border">
        {WEEK_DAYS.map((day) => {
          const dayItems = items.filter((i) => i.day_of_week === day.id);
          if (dayItems.length === 0) return null;
          return (
            <div
              key={day.id}
              className="flex flex-col gap-2.5 p-3 sm:flex-row sm:gap-4 sm:p-4"
            >
              <div className="sm:w-24 sm:shrink-0 sm:pt-1">
                <span className="text-foreground text-sm font-bold sm:text-base">
                  {day.short}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:block">
                  {day.name}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {dayItems.map((item) => (
                  <MealCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grocery list */}
      {grocery.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-overline">Grocery list</h2>
          <div className="bg-card border-border grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border p-4 sm:grid-cols-3">
            {grocery.map((line) => (
              <p key={line.name} className="text-foreground text-sm">
                {line.name}
                {line.count > 1 && (
                  <span className="text-muted-foreground text-xs">
                    {" "}
                    ×{line.count}
                  </span>
                )}
              </p>
            ))}
          </div>
        </section>
      )}

      <MealPlanActions intake={intake} />
    </div>
  );
}
