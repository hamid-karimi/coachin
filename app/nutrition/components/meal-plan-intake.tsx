"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles, X } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  generateMealPlanAction,
  type MealPlanActionState,
} from "../plan/actions";

const initialState: MealPlanActionState = {};

const GOALS = [
  ["lose", "Lose fat"],
  ["maintain", "Maintain"],
  ["gain", "Gain muscle"],
  ["recomp", "Recomp"],
] as const;

const DIETS = [
  "omnivore",
  "vegetarian",
  "vegan",
  "pescatarian",
  "halal",
  "keto",
] as const;

export function MealPlanIntake({
  hasTrainingPlan,
}: {
  hasTrainingPlan: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    generateMealPlanAction,
    initialState,
  );
  useActionToast(state);

  const [goal, setGoal] = useState("maintain");
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [suggestDismissed, setSuggestDismissed] = useState(false);

  const lastRef = useRef<MealPlanActionState>(initialState);
  useEffect(() => {
    if (state !== lastRef.current && state.success) {
      router.refresh();
    }
    lastRef.current = state;
  }, [state, router]);

  return (
    <div className="space-y-4">
      {!hasTrainingPlan && !suggestDismissed && (
        <div className="border-border bg-secondary/50 flex items-start justify-between gap-3 rounded-xl border p-3">
          <p className="text-muted-foreground text-sm">
            For a menu that matches your training load,{" "}
            <Link href="/training/new" className="text-brand-ink font-medium">
              build a training plan first
            </Link>
            . You can still generate one now from your body metrics.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSuggestDismissed(true)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <form
        action={formAction}
        className="bg-card border-border space-y-5 rounded-xl border p-4"
      >
        <input type="hidden" name="goal" value={goal} />
        <input type="hidden" name="meals_per_day" value={mealsPerDay} />

        <div className="space-y-2">
          <Label>Goal</Label>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGoal(value)}
                aria-pressed={goal === value}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  goal === value
                    ? "bg-brand text-brand-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-2">
            <Label htmlFor="diet">Diet</Label>
            <select
              id="diet"
              name="diet"
              defaultValue="omnivore"
              className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/25 h-11 rounded-md border px-3 text-sm capitalize outline-none focus-visible:ring-[3px]"
            >
              {DIETS.map((diet) => (
                <option key={diet} value={diet}>
                  {diet}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Meals / day</Label>
            <div className="flex gap-1.5">
              {[3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setMealsPerDay(count)}
                  aria-pressed={mealsPerDay === count}
                  className={cn(
                    "h-11 w-11 rounded-md text-sm font-semibold transition-colors",
                    mealsPerDay === count
                      ? "bg-brand text-brand-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="allergies">Allergies (comma-separated)</Label>
          <Input
            id="allergies"
            name="allergies"
            placeholder="peanuts, shellfish"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dislikes">Foods to avoid (comma-separated)</Label>
          <Input id="dislikes" name="dislikes" placeholder="mushrooms, olives" />
        </div>

        <Button type="submit" variant="brand" size="lg" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          {pending ? "Generating your week…" : "Generate meal plan"}
        </Button>
        <p className="text-muted-foreground text-xs">
          We size daily calories and macros from your height, weight, age, and
          weekly training days, then build a 7-day menu to match.
        </p>
      </form>
    </div>
  );
}
