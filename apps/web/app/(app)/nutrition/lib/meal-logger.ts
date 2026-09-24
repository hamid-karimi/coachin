import type { components } from "@/lib/api/schema";
import { toGrams, type FoodUnit } from "@/lib/food-units";
import type { MealType } from "./nutrition";

type LocalFood = components["schemas"]["FoodBody"];
type UsdaFood = components["schemas"]["USDAFoodBody"];
export type LogMealBody = components["schemas"]["LogMealInputBody"];

/** A food picked from search: a local row, or a USDA match (re-read by the API when logged). */
export type PickedFood = { kind: "local"; food: LocalFood } | { kind: "usda"; food: UsdaFood };

export type LoggerMode = "search" | "manual";

export interface LoggerState {
  mealType: MealType;
  mode: LoggerMode;
  picked: PickedFood | null;
  amount: string;
  unit: FoodUnit;
}

export type LoggerAction =
  | { type: "meal_type"; mealType: MealType }
  | { type: "mode"; mode: LoggerMode }
  | { type: "pick"; picked: PickedFood }
  | { type: "amount"; amount: string }
  | { type: "unit"; unit: FoodUnit }
  | { type: "clear" };

export const INITIAL_LOGGER: LoggerState = {
  mealType: "lunch",
  mode: "search",
  picked: null,
  amount: "100",
  unit: "g",
};

const cleared = (state: LoggerState): LoggerState => ({ ...state, picked: null, amount: "100", unit: "g" });

const HANDLERS: {
  [T in LoggerAction["type"]]: (s: LoggerState, a: Extract<LoggerAction, { type: T }>) => LoggerState;
} = {
  meal_type: (state, { mealType }) => ({ ...state, mealType }),
  mode: (state, { mode }) => ({ ...state, mode }),
  pick: (state, { picked }) => ({ ...state, picked }),
  amount: (state, { amount }) => ({ ...state, amount }),
  unit: (state, { unit }) => ({ ...state, unit }),
  clear: cleared,
};

export function loggerReducer(state: LoggerState, action: LoggerAction): LoggerState {
  return HANDLERS[action.type](state, action as never);
}

/** The picked amount in grams (0 when not a positive number). */
export function pickedGrams(state: Pick<LoggerState, "amount" | "unit">): number {
  return toGrams(Number(state.amount), state.unit);
}

/** Request body for a picked food. */
export function pickedMealBody(mealType: MealType, picked: PickedFood, grams: number): LogMealBody {
  return picked.kind === "local"
    ? { mealType, foodId: picked.food.id, quantityG: grams }
    : { mealType, usdaFdcId: picked.food.fdcId, quantityG: grams };
}

export interface ManualDraft {
  name: string;
  kcal: string;
  protein: string;
}

/** Request body for a hand-entered meal; blank protein counts as 0. */
export function manualMealBody(mealType: MealType, draft: ManualDraft): LogMealBody {
  return {
    mealType,
    manual: { name: draft.name.trim(), kcal: Number(draft.kcal), proteinG: Number(draft.protein) || 0 },
  };
}

/** The picked food's display: "389 kcal/100g · 60g". */
export function pickedSummary(picked: PickedFood, grams: number): string {
  return `${Math.round(picked.food.per100g.kcal)} kcal/100g · ${grams}g`;
}
