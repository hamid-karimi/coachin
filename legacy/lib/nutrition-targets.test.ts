import { describe, expect, it } from "vitest";

import {
  canComputeTargets,
  computeTargets,
  type TargetInputs,
} from "./nutrition-targets";

const base: TargetInputs = {
  sex: "male",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  trainingDaysPerWeek: 4,
  goal: "maintain",
};

describe("canComputeTargets", () => {
  it("requires age, height, and weight", () => {
    expect(canComputeTargets(base)).toBe(true);
    expect(canComputeTargets({ ...base, weightKg: null })).toBe(false);
    expect(canComputeTargets({ ...base, age: null })).toBe(false);
  });
});

describe("computeTargets", () => {
  it("returns null when metrics are missing", () => {
    expect(computeTargets({ ...base, heightCm: null })).toBeNull();
  });

  it("computes maintenance kcal via Mifflin–St Jeor × activity", () => {
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 1780; ×1.55 = 2759 → round10 2760.
    const t = computeTargets(base)!;
    expect(t.kcal).toBe(2760);
    expect(t.protein_g).toBe(Math.round(80 * 1.6)); // 128
  });

  it("cuts calories and lifts protein for a fat-loss goal", () => {
    const maintain = computeTargets(base)!;
    const lose = computeTargets({ ...base, goal: "lose" })!;
    expect(lose.kcal).toBeLessThan(maintain.kcal);
    expect(lose.protein_g).toBe(Math.round(80 * 2.2)); // 176
  });

  it("adds calories for a gain goal", () => {
    const maintain = computeTargets(base)!;
    const gain = computeTargets({ ...base, goal: "gain" })!;
    expect(gain.kcal).toBeGreaterThan(maintain.kcal);
  });

  it("keeps macros consistent with the calorie target", () => {
    const t = computeTargets(base)!;
    const fromMacros = t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9;
    // Rounding drift only — macros should reconstruct kcal within ~5%.
    expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(t.kcal * 0.05);
  });

  it("never drops below ~BMR even with more training", () => {
    const t = computeTargets({ ...base, goal: "lose", trainingDaysPerWeek: 0 })!;
    expect(t.kcal).toBeGreaterThanOrEqual(Math.round(1780 * 1.1 * 0.99));
  });
});
