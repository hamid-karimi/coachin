"use client";

import { useActionState } from "react";
import { Loader2, X } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { deleteMealLogAction, type NutritionActionState } from "../actions";

const initialState: NutritionActionState = {};

export type MealLog = {
  id: string;
  meal_type: string;
  free_text: string | null;
  quantity_g: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
  entry_method: string;
};

export function MealRow({ log }: { log: MealLog }) {
  const [state, formAction, pending] = useActionState(
    deleteMealLogAction,
    initialState,
  );
  useActionToast(state);

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-medium">
          {log.free_text ?? "Meal"}
          {log.entry_method === "photo" && (
            <span className="text-muted-foreground text-xs"> · photo</span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          {log.quantity_g ? `${Math.round(log.quantity_g)}g · ` : ""}
          {Math.round(log.protein_g)}P · {Math.round(log.carbs_g)}C ·{" "}
          {Math.round(log.fat_g)}F
          {Number(log.sugar_g) > 0
            ? ` · ${Math.round(log.sugar_g)}g sugar`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-stat text-brand-ink text-sm">
          {Math.round(log.kcal)} kcal
        </span>
        <form action={formAction}>
          <input type="hidden" name="log_id" value={log.id} />
          <button
            type="submit"
            disabled={pending}
            aria-label="Delete meal"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-6 place-items-center rounded-md transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <X className="size-3.5" aria-hidden />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
