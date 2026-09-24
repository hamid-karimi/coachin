import { describe, expect, it } from "vitest";

import { buildGroceryList } from "./meal-plan-grocery";

describe("buildGroceryList", () => {
  it("dedupes ingredients case-insensitively and counts uses", () => {
    const list = buildGroceryList([
      { ingredients: [{ name: "Chicken breast" }, { name: "Rice" }] },
      { ingredients: [{ name: "chicken breast" }, { name: "Broccoli" }] },
    ]);
    expect(list).toEqual([
      { name: "Broccoli", count: 1 },
      { name: "Chicken breast", count: 2 },
      { name: "Rice", count: 1 },
    ]);
  });

  it("skips blank names and missing ingredient arrays", () => {
    const list = buildGroceryList([
      { ingredients: [{ name: "  " }, { name: "Eggs" }] },
      { ingredients: null },
      {},
    ]);
    expect(list).toEqual([{ name: "Eggs", count: 1 }]);
  });

  it("returns an empty list for no items", () => {
    expect(buildGroceryList([])).toEqual([]);
  });
});
