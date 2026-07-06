import { describe, expect, it } from "vitest";

import {
  aggregateDaily,
  summarizePeriod,
  type DatedNutrients,
} from "./nutrition-trends";

function row(date: string, kcal: number, protein_g = 0): DatedNutrients {
  return {
    date,
    kcal,
    protein_g,
    carbs_g: 0,
    fat_g: 0,
    sugar_g: 0,
    fiber_g: 0,
    sodium_mg: 0,
  };
}

describe("aggregateDaily", () => {
  it("sums multiple logs on the same day", () => {
    const byDay = aggregateDaily([
      row("2026-07-06", 300, 20),
      row("2026-07-06", 200, 10),
      row("2026-07-05", 100, 5),
    ]);
    expect(byDay.get("2026-07-06")).toMatchObject({ kcal: 500, protein_g: 30 });
    expect(byDay.get("2026-07-05")?.kcal).toBe(100);
  });
});

describe("summarizePeriod", () => {
  it("builds a full window ending at today, oldest → newest", () => {
    const summary = summarizePeriod([row("2026-07-06", 500)], 7, "2026-07-06");
    expect(summary.series).toHaveLength(7);
    expect(summary.series[0].date).toBe("2026-06-30");
    expect(summary.series[6].date).toBe("2026-07-06");
    expect(summary.series[6].totals.kcal).toBe(500);
  });

  it("averages over logged days only", () => {
    const summary = summarizePeriod(
      [row("2026-07-06", 600, 40), row("2026-07-04", 400, 20)],
      7,
      "2026-07-06",
    );
    expect(summary.daysLogged).toBe(2);
    expect(summary.totalDays).toBe(7);
    expect(summary.avg.kcal).toBe(500); // (600+400)/2, not /7
    expect(summary.avg.protein_g).toBe(30);
  });

  it("returns zeroed averages when nothing is logged", () => {
    const summary = summarizePeriod([], 30, "2026-07-06");
    expect(summary.daysLogged).toBe(0);
    expect(summary.avg.kcal).toBe(0);
    expect(summary.series).toHaveLength(30);
  });

  it("ignores logs outside the window", () => {
    const summary = summarizePeriod(
      [row("2026-06-01", 999), row("2026-07-06", 500)],
      7,
      "2026-07-06",
    );
    expect(summary.daysLogged).toBe(1);
    expect(summary.avg.kcal).toBe(500);
  });
});
