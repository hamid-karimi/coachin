"use client";

import { useReducer } from "react";
import { Camera, PencilLine, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogMeal } from "../hooks/use-nutrition";
import {
  INITIAL_LOGGER,
  loggerReducer,
  manualMealBody,
  pickedGrams,
  pickedMealBody,
  type LoggerMode,
} from "../lib/meal-logger";
import { MEAL_TYPES } from "../lib/nutrition";
import { FoodSearchField } from "./food-search-field";
import { ManualMealForm } from "./manual-meal-form";
import { PhotoMode } from "./photo-mode";
import { PickedFoodForm } from "./picked-food-form";

const MODES: { value: LoggerMode; label: string; icon: typeof Search }[] = [
  { value: "search", label: "Search", icon: Search },
  { value: "photo", label: "Photo", icon: Camera },
  { value: "manual", label: "Manual", icon: PencilLine },
];

/** Log a meal: pick the meal type, then search (local or USDA), snap photos, or enter it by hand. */
export function MealLogger({ usdaEnabled }: { usdaEnabled: boolean }) {
  const [state, dispatch] = useReducer(loggerReducer, INITIAL_LOGGER);
  const log = useLogMeal();
  const grams = pickedGrams(state);

  return (
    <div className='bg-card border-border space-y-4 rounded-xl border p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex gap-1.5'>
          {MEAL_TYPES.map(({ value, label }) => (
            <button
              key={value}
              type='button'
              aria-pressed={state.mealType === value}
              onClick={() => dispatch({ type: "meal_type", mealType: value })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                state.mealType === value
                  ? "bg-brand text-brand-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}>
              {label}
            </button>
          ))}
        </div>
        <div className='flex gap-1.5'>
          {MODES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type='button'
              aria-pressed={state.mode === value}
              onClick={() => dispatch({ type: "mode", mode: value })}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                state.mode === value ? "bg-brand-tint text-brand-ink" : "text-muted-foreground hover:text-foreground",
              )}>
              <Icon className='size-3.5' aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {state.mode === "search" &&
        (state.picked ? (
          <PickedFoodForm
            picked={state.picked}
            amount={state.amount}
            unit={state.unit}
            grams={grams}
            pending={log.isPending}
            onAmount={(amount) => dispatch({ type: "amount", amount })}
            onUnit={(unit) => dispatch({ type: "unit", unit })}
            onClear={() => dispatch({ type: "clear" })}
            onLog={() =>
              state.picked &&
              log.mutate(
                { body: pickedMealBody(state.mealType, state.picked, grams) },
                { onSuccess: () => dispatch({ type: "clear" }) },
              )
            }
          />
        ) : (
          <FoodSearchField usdaEnabled={usdaEnabled} onPick={(picked) => dispatch({ type: "pick", picked })} />
        ))}

      {state.mode === "photo" && <PhotoMode mealType={state.mealType} usdaEnabled={usdaEnabled} />}

      {state.mode === "manual" && (
        <ManualMealForm
          pending={log.isPending}
          onLog={(draft, reset) => log.mutate({ body: manualMealBody(state.mealType, draft) }, { onSuccess: reset })}
        />
      )}
    </div>
  );
}
