import { describe, expect, it } from "vitest";
import {
  adherenceText,
  INITIAL_PLAN_DRAFT,
  mealVideoUrl,
  parseList,
  planDays,
  planDraftReducer,
  planIntakeBody,
  plannedMealLine,
  plannedMealsText,
  todaysMealsText,
  type PlannedMeal,
} from "./meal-plan";

const nutrients = { kcal: 450, proteinG: 20.4, carbsG: 70, fatG: 8, sugarG: 12, fiberG: 0, sodiumMg: 0 };
const meal = (dayOfWeek: number, title: string): PlannedMeal => ({
  id: title,
  dayOfWeek,
  mealType: "lunch",
  title,
  ingredients: [],
  recipe: "",
  videoQuery: "",
  nutrients,
});

describe("meal plan", () => {
  it("turns the wizard into a request", () => {
    let draft = planDraftReducer(INITIAL_PLAN_DRAFT, { field: "goal", value: "lose" });
    draft = planDraftReducer(draft, { field: "mealsPerDay", value: 4 });
    draft = planDraftReducer(draft, { field: "allergies", value: " peanuts, ,shellfish " });
    expect(planIntakeBody(draft)).toEqual({
      goal: "lose",
      diet: "omnivore",
      mealsPerDay: 4,
      allergies: ["peanuts", "shellfish"],
      dislikes: [],
    });
    expect(parseList(Array.from({ length: 25 }, (_, i) => `x${i}`).join(","))).toHaveLength(20);
  });

  it("orders the week Monday first and skips empty days", () => {
    const days = planDays([meal(0, "Sunday roast"), meal(1, "Monday oats"), meal(1, "Monday soup")]);
    expect(days.map((d) => [d.day.short, d.meals.length])).toEqual([
      ["Mon", 2],
      ["Sun", 1],
    ]);
  });

  it("describes meals and adherence", () => {
    expect(plannedMealLine(meal(1, "x"))).toBe("20g protein · 70g carbs · 8g fat · 12g sugar");
    expect(mealVideoUrl({ ...meal(1, "x"), videoQuery: "overnight oats" })).toBe(
      "https://www.youtube.com/results?search_query=overnight%20oats",
    );
    expect(mealVideoUrl(meal(1, "x"))).toBeNull();
    const base = { slotsPlanned: 3, kcalPlanned: 2000, kcalLogged: 1700 };
    expect(adherenceText({ ...base, slotsLogged: 0, kcalLogged: 0, kcalRatio: 0 })).toBe("No meals logged");
    expect(adherenceText({ ...base, slotsLogged: 2, kcalRatio: 0.853 })).toBe("2/3 meals logged · 85% of plan kcal");
    expect(adherenceText({ ...base, slotsLogged: 2, kcalRatio: null })).toBe("2/3 meals logged");
    expect(plannedMealsText(1, 1150.4)).toBe("1 meal planned · 1,150 kcal");
    expect(todaysMealsText([{ kcal: 600.4 }, { kcal: 1250 }], 2100)).toBe("1,850 kcal planned · target 2,100");
    expect(todaysMealsText([{ kcal: 500 }], 0)).toBe("500 kcal planned");
  });
});
