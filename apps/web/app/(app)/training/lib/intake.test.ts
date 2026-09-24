import { describe, expect, it } from "vitest";
import { hasBodyProfile, planKindFrom, profileSummary, type IntakeContext } from "./intake";

const empty: IntakeContext = {
  forStudent: false,
  athleteName: "",
  age: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  trainingHistory: null,
};

describe("intake", () => {
  it("summarizes the body profile", () => {
    const full = { ...empty, age: 36, sex: "female", heightCm: 168.5, weightKg: 61, trainingHistory: "Ran two marathons" };
    expect(profileSummary(full)).toBe("36 years old · female · 168.5cm · 61kg — Ran two marathons");
    expect(hasBodyProfile(full)).toBe(true);
    expect(profileSummary(empty)).toBe("No body profile yet — the plan will rely on your answers only.");
    expect(hasBodyProfile({ ...empty, age: 30, sex: "male" })).toBe(false);
  });

  it("reads the plan kind", () => {
    expect(planKindFrom("race")).toBe("race");
    expect(planKindFrom("hypertrophy")).toBe("hypertrophy");
    expect(planKindFrom(["race"])).toBeNull();
    expect(planKindFrom(undefined)).toBeNull();
  });
});
