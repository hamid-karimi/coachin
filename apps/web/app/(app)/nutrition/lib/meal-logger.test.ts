import { describe, expect, it } from "vitest";
import {
  INITIAL_LOGGER,
  loggerReducer,
  manualMealBody,
  pickedGrams,
  pickedMealBody,
  pickedSummary,
  type PickedFood,
} from "./meal-logger";

const per100g = { kcal: 389, proteinG: 16.9, carbsG: 66, fatG: 6.9, sugarG: 0, fiberG: 10, sodiumMg: 2 };
const oats: PickedFood = { kind: "local", food: { id: "f1", name: "Oats", source: "seed", per100g } };
const banana: PickedFood = { kind: "usda", food: { fdcId: 173944, name: "Bananas, raw", per100g } };

describe("meal logger", () => {
  it("picks, sizes, and clears", () => {
    let state = loggerReducer(INITIAL_LOGGER, { type: "pick", picked: oats });
    state = loggerReducer(state, { type: "amount", amount: "2" });
    state = loggerReducer(state, { type: "unit", unit: "cup" });
    expect(pickedGrams(state)).toBe(480);
    state = loggerReducer(state, { type: "meal_type", mealType: "dinner" });
    state = loggerReducer(state, { type: "clear" });
    expect(state).toEqual({ ...INITIAL_LOGGER, mealType: "dinner" });
    expect(pickedGrams({ amount: "abc", unit: "g" })).toBe(0);
  });

  it("builds bodies for local, USDA, and manual meals", () => {
    expect(pickedMealBody("lunch", oats, 60)).toEqual({ mealType: "lunch", foodId: "f1", quantityG: 60 });
    expect(pickedMealBody("snack", banana, 120)).toEqual({ mealType: "snack", usdaFdcId: 173944, quantityG: 120 });
    expect(manualMealBody("dinner", { name: " Soup ", kcal: "300", protein: "" })).toEqual({
      mealType: "dinner",
      manual: { name: "Soup", kcal: 300, proteinG: 0 },
    });
    expect(pickedSummary(oats, 60)).toBe("389 kcal/100g · 60g");
  });
});
