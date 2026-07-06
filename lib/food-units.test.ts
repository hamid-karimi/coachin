import { describe, expect, it } from "vitest";

import { FOOD_UNIT_OPTIONS, isFoodUnit, toGrams } from "./food-units";

describe("toGrams", () => {
  it("passes grams through", () => {
    expect(toGrams(220, "g")).toBe(220);
  });

  it("converts household units", () => {
    expect(toGrams(2, "tbsp")).toBe(30);
    expect(toGrams(1, "cup")).toBe(240);
    expect(toGrams(3, "tsp")).toBe(15);
  });

  it("treats unknown units as grams", () => {
    expect(toGrams(50, "banana")).toBe(50);
  });

  it("guards non-positive or non-finite quantities", () => {
    expect(toGrams(0, "tbsp")).toBe(0);
    expect(toGrams(-5, "g")).toBe(0);
    expect(toGrams(Number.NaN, "cup")).toBe(0);
  });
});

describe("isFoodUnit", () => {
  it("recognises known units and rejects others", () => {
    expect(isFoodUnit("tbsp")).toBe(true);
    expect(isFoodUnit("banana")).toBe(false);
  });
});

describe("FOOD_UNIT_OPTIONS", () => {
  it("lists grams first and only known units", () => {
    expect(FOOD_UNIT_OPTIONS[0].value).toBe("g");
    expect(FOOD_UNIT_OPTIONS.every((o) => isFoodUnit(o.value))).toBe(true);
  });
});
