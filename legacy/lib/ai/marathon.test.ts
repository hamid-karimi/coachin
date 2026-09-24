import { describe, expect, it } from "vitest";

import { validateItems } from "./marathon";

const valid = {
  week: 1,
  day_of_week: 2,
  item_type: "strength",
  title: "Upper body — Day A",
};

describe("validateItems", () => {
  it("returns [] for non-array input", () => {
    expect(validateItems(null)).toEqual([]);
    expect(validateItems({})).toEqual([]);
  });

  it("keeps valid items and drops broken ones", () => {
    const items = validateItems([
      valid,
      { ...valid, week: 0 }, // week out of range
      { ...valid, day_of_week: 7 }, // day out of range
      { ...valid, item_type: "yoga" }, // unknown type
      { ...valid, title: "  " }, // empty title
      "not an object",
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      week: 1,
      day_of_week: 2,
      item_type: "strength",
      title: "Upper body — Day A",
    });
  });

  it("trims description and omits it when empty or missing", () => {
    const [withDesc, blankDesc, noDesc] = validateItems([
      { ...valid, description: "  Bench press 4x8 + rows 3x10  " },
      { ...valid, description: "   " },
      valid,
    ]);
    expect(withDesc.description).toBe("Bench press 4x8 + rows 3x10");
    expect(blankDesc.description).toBeUndefined();
    expect(noDesc.description).toBeUndefined();
  });

  it("slices description to 2000 chars and title to 200", () => {
    const [item] = validateItems([
      { ...valid, title: "t".repeat(300), description: "d".repeat(3000) },
    ]);
    expect(item.title).toHaveLength(200);
    expect(item.description).toHaveLength(2000);
  });

  it("ignores non-string descriptions", () => {
    const [item] = validateItems([{ ...valid, description: 42 }]);
    expect(item.description).toBeUndefined();
  });
});
