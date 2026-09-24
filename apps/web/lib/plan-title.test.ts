import { describe, expect, it } from "vitest";
import { planTitleFor } from "./plan-title";

describe("planTitleFor", () => {
  it("titles hypertrophy plans from plan_kind", () => {
    expect(planTitleFor("hypertrophy")).toBe("Muscle building plan");
  });

  it("titles a base running plan", () => {
    expect(planTitleFor("race", "base")).toBe("Running plan");
  });

  it("titles named race distances", () => {
    expect(planTitleFor("race", "half")).toBe("Half marathon plan");
  });

  it("includes distance for ultra and other", () => {
    expect(planTitleFor("race", "ultra", 50)).toBe("Ultra plan (50km)");
    expect(planTitleFor("race", "other", 30)).toBe("30km race plan");
  });

  it("falls back to Marathon plan for unknown or missing targets", () => {
    expect(planTitleFor("race", "mystery")).toBe("Marathon plan");
    expect(planTitleFor("race")).toBe("Marathon plan");
  });
});
