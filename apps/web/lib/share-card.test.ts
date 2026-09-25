import { describe, expect, it } from "vitest";
import {
  dayShareCard,
  mealShareCard,
  progressShareCard,
  sessionShareCard,
  shareCardAlt,
  shareDateLabel,
  weeksBetween,
} from "./share-card";

describe("sessionShareCard", () => {
  it("builds volume, exercises, and sets stats with the equivalence line", () => {
    const card = sessionShareCard({
      title: "Upper body — Day A",
      totalVolumeKg: 1540,
      exercises: [
        {
          name: "Goblet squat",
          sets: [
            { weight_kg: 20, reps: 10 },
            { weight_kg: 20, reps: 10 },
          ],
        },
        { name: "Floor press", sets: [{ weight_kg: 15, reps: 12 }] },
      ],
      date: new Date("2026-07-09T12:00:00"),
    });
    expect(card).toEqual({
      headline: "Upper body — Day A",
      stats: [
        { label: "kg lifted", value: "1,540" },
        { label: "exercises", value: "2" },
        { label: "sets", value: "3" },
      ],
      equivalence: "that's a small car 🚗",
      dateLabel: "Thu, Jul 9",
    });
  });

  it("uses singular labels for one exercise or set", () => {
    const card = sessionShareCard({
      title: "Quick pump",
      totalVolumeKg: 200,
      exercises: [{ name: "Row", sets: [{ weight_kg: 20, reps: 10 }] }],
    });
    expect(card.stats.map((stat) => stat.label)).toEqual(["kg lifted", "exercise", "set"]);
  });

  it("omits empty stats and the equivalence at zero volume", () => {
    const card = sessionShareCard({ title: "Mobility", totalVolumeKg: 0 });
    expect(card.stats).toEqual([]);
    expect(card).not.toHaveProperty("equivalence");
  });

  it("caps overlong headlines and falls back when blank", () => {
    expect(sessionShareCard({ title: "x".repeat(200), totalVolumeKg: 0 }).headline).toHaveLength(60);
    expect(sessionShareCard({ title: "  ", totalVolumeKg: 0 }).headline).toBe("Training day");
  });
});

describe("mealShareCard / dayShareCard", () => {
  it("renders kcal and protein, dropping protein when missing", () => {
    expect(mealShareCard({ title: "Ghormeh sabzi", kcal: 620.4, proteinG: 32 }).stats).toEqual([
      { label: "kcal", value: "620" },
      { label: "g protein", value: "32" },
    ]);
    expect(mealShareCard({ title: "Apple", kcal: 80, proteinG: null }).stats).toEqual([{ label: "kcal", value: "80" }]);
  });

  it("falls back to 'Meal' for a blank meal title", () => {
    expect(mealShareCard({ title: "", kcal: 300 }).headline).toBe("Meal");
  });

  it("pluralizes meals and never carries a target", () => {
    expect(dayShareCard({ kcal: 2100, proteinG: 130, mealsCount: 1 }).stats).toEqual([
      { label: "kcal", value: "2,100" },
      { label: "g protein", value: "130" },
      { label: "meal", value: "1" },
    ]);
    expect(dayShareCard({ kcal: 2100, proteinG: 0, mealsCount: 4 }).stats[1]).toEqual({ label: "meals", value: "4" });
  });
});

describe("progress cards", () => {
  it("counts whole weeks, at least one", () => {
    expect(weeksBetween("2026-03-01T00:00:00Z", "2026-06-21T00:00:00Z")).toBe(16);
    expect(weeksBetween("2026-06-21T00:00:00Z", "2026-03-01T00:00:00Z")).toBe(16);
    expect(weeksBetween("2026-03-01T00:00:00Z", "2026-03-02T00:00:00Z")).toBe(1);
  });

  it("carries the month range and the week count", () => {
    expect(progressShareCard("2026-03-10T12:00:00Z", "2026-06-30T12:00:00Z")).toEqual({
      headline: "Progress, not perfection",
      stats: [{ label: "weeks between", value: "16" }],
      dateLabel: "Mar 2026 → Jun 2026",
    });
    expect(progressShareCard("2026-03-10T12:00:00Z", "2026-03-15T12:00:00Z").stats[0].label).toBe("week between");
  });
});

describe("labels", () => {
  it("formats the card date", () => {
    expect(shareDateLabel(new Date("2026-09-25T12:00:00"))).toBe("Fri, Sep 25");
  });

  it("describes the card for screen readers", () => {
    expect(shareCardAlt(mealShareCard({ title: "Oats", kcal: 450, proteinG: 20 }))).toBe(
      "Share card preview: Oats, 450 kcal, 20 g protein",
    );
  });
});
