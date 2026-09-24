import { describe, expect, it } from "vitest";

import {
  dayShareCard,
  mealShareCard,
  progressShareCard,
  sessionShareCard,
} from "./share-card";

describe("sessionShareCard", () => {
  it("builds volume, exercises, and sets stats with the equivalence line", () => {
    const cardData = sessionShareCard({
      title: "Upper body — Day A",
      totalVolumeKg: 1540,
      exercises: [
        { name: "Goblet squat", sets: [{ weight_kg: 20, reps: 10 }, { weight_kg: 20, reps: 10 }] },
        { name: "Floor press", sets: [{ weight_kg: 15, reps: 12 }] },
      ],
      date: new Date("2026-07-09T12:00:00"),
    });
    expect(cardData.headline).toBe("Upper body — Day A");
    expect(cardData.stats).toEqual([
      { label: "kg lifted", value: "1,540" },
      { label: "exercises", value: "2" },
      { label: "sets", value: "3" },
    ]);
    expect(cardData.equivalence).toContain("small car");
    expect(cardData.dateLabel).toContain("Jul");
  });

  it("omits empty stats and equivalence at zero volume", () => {
    const cardData = sessionShareCard({ title: "Mobility", totalVolumeKg: 0 });
    expect(cardData.stats).toEqual([]);
    expect(cardData.equivalence).toBeUndefined();
  });

  it("caps overlong headlines and falls back when blank", () => {
    expect(sessionShareCard({ title: "x".repeat(200), totalVolumeKg: 0 }).headline).toHaveLength(60);
    expect(sessionShareCard({ title: "  ", totalVolumeKg: 0 }).headline).toBe("Training day");
  });
});

describe("mealShareCard / dayShareCard", () => {
  it("renders kcal and protein, dropping protein when missing", () => {
    expect(
      mealShareCard({ title: "Ghormeh sabzi", kcal: 620.4, proteinG: 32 }).stats,
    ).toEqual([
      { label: "kcal", value: "620" },
      { label: "g protein", value: "32" },
    ]);
    expect(mealShareCard({ title: "Apple", kcal: 80 }).stats).toEqual([
      { label: "kcal", value: "80" },
    ]);
  });

  it("blank meal titles fall back to 'Meal', not the session fallback", () => {
    expect(mealShareCard({ title: "", kcal: 300 }).headline).toBe("Meal");
  });

  it("day card pluralizes meals", () => {
    expect(
      dayShareCard({ kcal: 2100, proteinG: 130, mealsCount: 1 }).stats[2],
    ).toEqual({ label: "meal", value: "1" });
    expect(
      dayShareCard({ kcal: 2100, proteinG: 130, mealsCount: 4 }).stats[2],
    ).toEqual({ label: "meals", value: "4" });
  });
});

describe("progressShareCard", () => {
  it("carries the date range and week count", () => {
    const cardData = progressShareCard({
      fromLabel: "Mar 2026",
      toLabel: "Jul 2026",
      weeksBetween: 16,
    });
    expect(cardData.stats).toEqual([{ label: "weeks between", value: "16" }]);
    expect(cardData.dateLabel).toBe("Mar 2026 → Jul 2026");
  });
});
