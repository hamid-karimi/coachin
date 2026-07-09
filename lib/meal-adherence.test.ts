import { describe, expect, it } from "vitest";

import { mealAdherenceForDay } from "./meal-adherence";

const plan = [
  { meal_type: "breakfast", kcal: 400 },
  { meal_type: "lunch", kcal: 600 },
  { meal_type: "dinner", kcal: 500 },
];

describe("mealAdherenceForDay", () => {
  it("scores full adherence when every planned slot is logged", () => {
    const result = mealAdherenceForDay(plan, [
      { meal_type: "breakfast", kcal: 380 },
      { meal_type: "lunch", kcal: 610 },
      { meal_type: "dinner", kcal: 520 },
    ]);
    expect(result.slotsPlanned).toBe(3);
    expect(result.slotsLogged).toBe(3);
    expect(result.kcalPlanned).toBe(1500);
    expect(result.kcalLogged).toBe(1510);
    expect(result.kcalRatio).toBeCloseTo(1510 / 1500);
  });

  it("scores partial adherence when only some slots are logged", () => {
    const result = mealAdherenceForDay(plan, [
      { meal_type: "breakfast", kcal: 400 },
      { meal_type: "lunch", kcal: 550 },
    ]);
    expect(result.slotsLogged).toBe(2);
    expect(result.kcalLogged).toBe(950);
  });

  it("scores zero slots and zero kcal when nothing is logged", () => {
    const result = mealAdherenceForDay(plan, []);
    expect(result.slotsPlanned).toBe(3);
    expect(result.slotsLogged).toBe(0);
    expect(result.kcalLogged).toBe(0);
    expect(result.kcalRatio).toBe(0);
  });

  it("ignores unplanned meal types for slots but counts their kcal", () => {
    const result = mealAdherenceForDay(plan, [
      { meal_type: "breakfast", kcal: 400 },
      { meal_type: "snack", kcal: 250 },
    ]);
    expect(result.slotsLogged).toBe(1);
    expect(result.kcalLogged).toBe(650);
  });

  it("returns a null ratio when nothing was planned", () => {
    const result = mealAdherenceForDay([], [{ meal_type: "lunch", kcal: 300 }]);
    expect(result.slotsPlanned).toBe(0);
    expect(result.kcalPlanned).toBe(0);
    expect(result.kcalLogged).toBe(300);
    expect(result.kcalRatio).toBeNull();
  });

  it("counts a planned slot once even with multiple matching logs", () => {
    const result = mealAdherenceForDay(plan, [
      { meal_type: "lunch", kcal: 300 },
      { meal_type: "lunch", kcal: 350 },
    ]);
    expect(result.slotsLogged).toBe(1);
    expect(result.kcalLogged).toBe(650);
  });
});
