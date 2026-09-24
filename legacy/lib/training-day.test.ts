import { describe, expect, it } from "vitest";

import { hasHardCollision } from "./training-day";

describe("hasHardCollision", () => {
  it("is true for two runs on the same day", () => {
    expect(
      hasHardCollision([{ item_type: "run" }, { item_type: "run" }]),
    ).toBe(true);
  });

  it("is true for a run plus a strength session", () => {
    expect(
      hasHardCollision([{ item_type: "run" }, { item_type: "strength" }]),
    ).toBe(true);
  });

  it("is false for a run plus a stretch (only one hard session)", () => {
    expect(
      hasHardCollision([{ item_type: "run" }, { item_type: "stretch" }]),
    ).toBe(false);
  });

  it("is false for a single run", () => {
    expect(hasHardCollision([{ item_type: "run" }])).toBe(false);
  });

  it("is false for an empty day", () => {
    expect(hasHardCollision([])).toBe(false);
  });
});
