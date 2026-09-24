import { describe, expect, it } from "vitest";
import {
  goalPercent,
  kcalText,
  mealDetail,
  mealGroups,
  microLine,
  weekBars,
  weekdayInitial,
  type Meal,
} from "./nutrition";

const nutrients = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, sugarG: 0, fiberG: 0, sodiumMg: 0 };
const meal = (mealType: Meal["mealType"], kcal: number, extra: Partial<Meal> = {}): Meal => ({
  id: `${mealType}-${kcal}`,
  mealType,
  name: "Food",
  quantityG: null,
  entryMethod: "manual",
  nutrients: { ...nutrients, kcal },
  ...extra,
});

describe("nutrition page helpers", () => {
  it("groups meals by type in day order", () => {
    const groups = mealGroups([meal("snack", 100), meal("breakfast", 300), meal("snack", 50)]);
    expect(groups.map((g) => [g.label, g.meals.length, g.kcal])).toEqual([
      ["Breakfast", 1, 300],
      ["Snacks", 2, 150],
    ]);
  });

  it("formats totals against the goal", () => {
    expect(kcalText(1249.6)).toBe("1,250");
    expect(goalPercent(1500, 2000)).toBe(75);
    expect(goalPercent(2600, 2000)).toBe(100);
    expect(goalPercent(1500, null)).toBeNull();
  });

  it("describes a meal", () => {
    const logged = meal("lunch", 250, {
      quantityG: 150.4,
      nutrients: { ...nutrients, kcal: 250, proteinG: 30.4, carbsG: 0, fatG: 5.5, sugarG: 2 },
    });
    expect(mealDetail(logged)).toBe("150g · 30g protein · 0g carbs · 6g fat · 2g sugar");
    expect(mealDetail(meal("lunch", 100))).toBe("0g protein · 0g carbs · 0g fat");
    expect(microLine({ ...nutrients, sugarG: 4.6, fiberG: 3, sodiumMg: 401 })).toBe(
      "5g sugar · 3g fiber · 401mg sodium",
    );
  });

  it("scales the week chart to the goal or the peak", () => {
    const trend = {
      series: [
        { date: "2026-09-21", totals: { ...nutrients, kcal: 0 } },
        { date: "2026-09-22", totals: { ...nutrients, kcal: 2500 } },
        { date: "2026-09-23", totals: { ...nutrients, kcal: 1000 } },
      ],
      daysLogged: 2,
      totalDays: 3,
      avg: nutrients,
    };
    const withGoal = weekBars(trend, 2000);
    expect(withGoal.goalPct).toBe(80);
    expect(withGoal.bars.map((b) => [b.initial, b.tone, b.heightPct])).toEqual([
      ["M", "empty", 2],
      ["T", "hit", 100],
      ["W", "logged", 40],
    ]);
    expect(weekBars(trend, null).goalPct).toBeNull();
    expect(weekdayInitial("2026-09-27")).toBe("S");
  });
});
