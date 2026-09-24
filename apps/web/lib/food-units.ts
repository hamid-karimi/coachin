/**
 * Household → grams conversion for meal logging. The whole nutrition stack is
 * mass-based (foods are per-100g), so every amount is normalised to grams on
 * submit. Volume units use approximate densities (fine for portion logging);
 * unknown units fall back to grams so this never throws. A copy of the API's
 * domain/nutrition math, replaying the same golden vectors.
 */

export type FoodUnit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "oz"
  | "lb"
  | "slice"
  | "piece"
  | "handful"
  | "serving";

const GRAMS_PER_UNIT: Record<FoodUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1, // ~water density
  l: 1000,
  tsp: 5,
  tbsp: 15,
  cup: 240,
  oz: 28.35,
  lb: 453.6,
  slice: 30, // generic (bread-ish)
  piece: 50, // generic single item
  handful: 30,
  serving: 100,
};

/** Human labels for the amount-unit dropdown, in display order. */
export const FOOD_UNIT_OPTIONS: { value: FoodUnit; label: string }[] = [
  { value: "g", label: "g" },
  { value: "ml", label: "ml" },
  { value: "tsp", label: "tsp" },
  { value: "tbsp", label: "tbsp" },
  { value: "cup", label: "cup" },
  { value: "oz", label: "oz" },
  { value: "slice", label: "slice" },
  { value: "piece", label: "piece" },
  { value: "handful", label: "handful" },
  { value: "serving", label: "serving" },
];

/** True for a value that is a known FoodUnit. */
export function isFoodUnit(value: string): value is FoodUnit {
  return value in GRAMS_PER_UNIT;
}

/**
 * Convert `qty` of `unit` to grams, rounded to 1 decimal. Non-finite or
 * negative quantities yield 0; unknown units are treated as grams.
 */
export function toGrams(qty: number, unit: string): number {
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  const perUnit = isFoodUnit(unit) ? GRAMS_PER_UNIT[unit] : 1;
  return Math.round(qty * perUnit * 10) / 10;
}
