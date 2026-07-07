import { describe, expect, it } from "vitest";

import { planTitleFor } from "./plan-title";

describe("planTitleFor", () => {
  it("titles hypertrophy plans from plan_kind", () => {
    expect(planTitleFor("hypertrophy", null)).toBe("Muscle building plan");
  });

  it("titles a base running plan", () => {
    expect(planTitleFor("race", { race_target: "base" })).toBe("Running plan");
  });

  it("titles named race distances", () => {
    expect(planTitleFor("race", { race_target: "half" })).toBe(
      "Half marathon plan",
    );
  });

  it("includes distance for ultra", () => {
    expect(
      planTitleFor("race", { race_target: "ultra", race_distance_km: 50 }),
    ).toBe("Ultra plan (50km)");
  });

  it("falls back to Marathon plan for unknown targets", () => {
    expect(planTitleFor("race", { race_target: "mystery" })).toBe(
      "Marathon plan",
    );
  });
});
