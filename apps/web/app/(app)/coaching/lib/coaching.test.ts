import { describe, expect, it } from "vitest";
import {
  adherenceLine,
  coachingSummaryLine,
  dayKcal,
  offTrackChips,
  rosterLine,
  takenRateText,
  targetsLine,
  traineeDayLabel,
  traineeSubtitle,
  weeklyRanking,
  type Trainee,
} from "./coaching";

const trainee = (id: string, weeklyXp: number): Trainee => ({
  id,
  name: id,
  email: `${id}@x.com`,
  avatarUrl: null,
  level: 2,
  xp: 1200,
  tier: "bronze",
  weeklyXp,
  week: [],
  doneCount: 0,
  scheduledCount: 0,
  plans: [],
  nutritionShared: false,
});

describe("coaching", () => {
  it("describes a trainee", () => {
    expect(traineeSubtitle({ sport: { id: 1, name: "Running" }, level: 3, weeklyXp: 1200 })).toBe(
      "Running · Level 3 · 1,200 XP this week",
    );
    expect(traineeSubtitle({ level: 1, weeklyXp: 0 })).toBe("General coaching · Level 1 · 0 XP this week");
    expect(adherenceLine({ doneCount: 2, scheduledCount: 3 })).toBe("2 of 3 this week");
    expect(adherenceLine({ doneCount: 0, scheduledCount: 0 })).toBe("No plan assigned yet");
  });

  it("flags plans under 50%", () => {
    const chips = offTrackChips({
      plans: [
        { planId: "a", kind: "hypertrophy", adherencePct: 40.4 },
        { planId: "b", kind: "race", adherencePct: 50 },
        { planId: "c", kind: "race", adherencePct: 12 },
      ],
    });
    expect(chips.map((c) => c.label)).toEqual(["Off-track · Strength 40%", "Off-track · Running 12%"]);
  });

  it("ranks by weekly XP, once per trainee", () => {
    const ranked = weeklyRanking([trainee("a", 10), trainee("b", 90), trainee("a", 10), trainee("c", 10)]);
    expect(ranked.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("summarizes", () => {
    expect(rosterLine(0)).toBe("No trainees yet — share an invite code to connect.");
    expect(rosterLine(1)).toBe("1 active trainee");
    expect(coachingSummaryLine(2, 1)).toBe("2 trainees · 1 trained this week");
  });
});

describe("trainee nutrition", () => {
  it("formats targets, days, and taken rates", () => {
    expect(targetsLine({ kcal: 2100, proteinG: 140 })).toBe("Meal plan targets: 2,100 kcal · 140g protein");
    expect(targetsLine({ kcal: 2100, proteinG: 0 })).toBe("Meal plan targets: 2,100 kcal");
    expect(targetsLine(undefined)).toBeNull();
    expect(dayKcal({ totalKcal: 2250.4 }, 2100)).toEqual({ text: "2,250 kcal / 2,100", over: true });
    expect(dayKcal({ totalKcal: 800 })).toEqual({ text: "800 kcal", over: false });
    expect(traineeDayLabel("2026-09-25")).toBe("Fri, Sep 25");
    expect(takenRateText({ takenDueDays: 5, totalDueDays: 7 })).toBe("5/7 due days");
    expect(takenRateText({ takenDueDays: 0, totalDueDays: 0 })).toBe("No due days in the last week");
  });
});
