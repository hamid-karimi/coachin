import { describe, expect, it } from "vitest";
import {
  availableGoalTypes,
  bodyProfileInput,
  featuredGoal,
  goalInput,
  goalLabel,
  goalStatusLine,
  measurementDateLabel,
  measurementInput,
  measurementLine,
  resolveProfileTab,
  profileTabHref,
  type ActiveGoal,
} from "./profile";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const goal = (overrides: Partial<ActiveGoal>): ActiveGoal => ({
  id: "g1",
  goalType: "weight",
  target: 70,
  start: 80,
  targetDate: null,
  achievedAt: null,
  current: 75,
  progress: { pct: 50, direction: "down", achieved: false },
  ...overrides,
});

describe("profile tabs", () => {
  it("falls back to overview", () => {
    expect(resolveProfileTab("progress")).toBe("progress");
    expect(resolveProfileTab("admin")).toBe("overview");
    expect(resolveProfileTab(["body"])).toBe("overview");
    expect(resolveProfileTab(undefined)).toBe("overview");
    expect(profileTabHref("overview")).toBe("/profile");
    expect(profileTabHref("body")).toBe("/profile?tab=body");
  });
});

describe("goals", () => {
  it("labels and status lines", () => {
    expect(goalLabel({ goalType: "body_fat_pct", target: 15.5 })).toBe("Body fat 15.5%");
    expect(goalStatusLine(goal({ targetDate: "2026-12-31" }))).toBe("75kg now · 50% there · by Dec 31");
    expect(goalStatusLine(goal({ progress: undefined, current: null }))).toBe("Log a measurement to start tracking.");
    expect(goalStatusLine(goal({ goalType: "weekly_run_km", progress: undefined, current: null }))).toBe(
      "Tracking arrives once runs carry distance.",
    );
  });

  it("offers only types without an active goal", () => {
    expect(availableGoalTypes([{ goalType: "weight" }, { goalType: "calorie_intake" }])).toEqual([
      "body_fat_pct",
      "calories_burned",
      "weekly_run_km",
      "monthly_run_km",
    ]);
  });

  it("features the tracked goal closest to done", () => {
    const near = goal({ id: "near", progress: { pct: 80, direction: "up", achieved: false } });
    expect(featuredGoal([goal({}), goal({ id: "untracked", progress: undefined }), near])?.id).toBe("near");
    expect(featuredGoal([goal({ progress: undefined })])).toBeNull();
  });
});

describe("measurements", () => {
  it("formats a reading", () => {
    expect(measurementLine({ weightKg: 72.5, bodyFatPct: 18 })).toBe("72.5 kg · 18% body fat");
    expect(measurementLine({ weightKg: null, bodyFatPct: 18 })).toBe("18% body fat");
    expect(measurementDateLabel("2026-09-20")).toBe("Sun, Sep 20");
  });
});

describe("form bodies", () => {
  it("maps blanks to clears and numbers", () => {
    expect(
      bodyProfileInput(form({ birthDate: "1994-05-01", sex: "", heightCm: " 181.5 ", country: " Iran " })),
    ).toEqual({
      birthDate: "1994-05-01",
      sex: "",
      heightCm: 181.5,
      trainingHistory: "",
      country: "Iran",
    });
    expect(measurementInput(form({ weightKg: "", bodyFatPct: "18" }))).toEqual({ weightKg: undefined, bodyFatPct: 18 });
    expect(goalInput(form({ goalType: "weight", target: "70", targetDate: "" }))).toEqual({
      goalType: "weight",
      target: 70,
      targetDate: "",
    });
  });
});
