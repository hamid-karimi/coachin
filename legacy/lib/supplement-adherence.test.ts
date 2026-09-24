import { describe, expect, it } from "vitest";

import { supplementTakenRate, type WindowDay } from "./supplement-adherence";
import type { SupplementSchedule } from "./supplement-schedule";

// A fixed 7-day window: Mon 2026-07-06 … Sun 2026-07-12. Tue + Thu are training
// days; the rest are rest days.
const WINDOW: WindowDay[] = [
  { ymd: "2026-07-06", weekday: 1, isTrainingDay: false }, // Mon
  { ymd: "2026-07-07", weekday: 2, isTrainingDay: true }, // Tue
  { ymd: "2026-07-08", weekday: 3, isTrainingDay: false }, // Wed
  { ymd: "2026-07-09", weekday: 4, isTrainingDay: true }, // Thu
  { ymd: "2026-07-10", weekday: 5, isTrainingDay: false }, // Fri
  { ymd: "2026-07-11", weekday: 6, isTrainingDay: false }, // Sat
  { ymd: "2026-07-12", weekday: 0, isTrainingDay: false }, // Sun
];

const DAILY: SupplementSchedule = { scheduleType: "daily", daysOfWeek: null };

describe("supplementTakenRate", () => {
  it("counts every window day for a daily supplement created before it", () => {
    const taken = new Set(["2026-07-06", "2026-07-08", "2026-07-12"]);
    expect(supplementTakenRate(DAILY, "2026-07-01", WINDOW, taken)).toEqual({
      takenDueDays: 3,
      totalDueDays: 7,
    });
  });

  it("excludes days before the supplement's created date", () => {
    // Created Thu 2026-07-09 → only Thu, Fri, Sat, Sun are eligible.
    const taken = new Set(["2026-07-06", "2026-07-09", "2026-07-11"]);
    expect(supplementTakenRate(DAILY, "2026-07-09", WINDOW, taken)).toEqual({
      takenDueDays: 2, // 07-09 + 07-11 (07-06 is before created)
      totalDueDays: 4,
    });
  });

  it("only counts training days for a training_days supplement", () => {
    const schedule: SupplementSchedule = {
      scheduleType: "training_days",
      daysOfWeek: null,
    };
    const taken = new Set(["2026-07-07", "2026-07-08"]); // Tue (due) + Wed (rest)
    expect(supplementTakenRate(schedule, "2026-07-01", WINDOW, taken)).toEqual({
      takenDueDays: 1, // only Tue counts; Wed is not a due day
      totalDueDays: 2, // Tue + Thu
    });
  });

  it("counts only the listed weekdays for a custom supplement", () => {
    const schedule: SupplementSchedule = {
      scheduleType: "custom",
      daysOfWeek: [1, 5], // Mon + Fri
    };
    const taken = new Set(["2026-07-06"]); // Mon
    expect(supplementTakenRate(schedule, "2026-07-01", WINDOW, taken)).toEqual({
      takenDueDays: 1,
      totalDueDays: 2, // Mon + Fri
    });
  });

  it("reports zero due days when a training_days supplement has no training days in the window", () => {
    const restOnly: WindowDay[] = WINDOW.map((day) => ({
      ...day,
      isTrainingDay: false,
    }));
    const schedule: SupplementSchedule = {
      scheduleType: "training_days",
      daysOfWeek: null,
    };
    expect(
      supplementTakenRate(schedule, "2026-07-01", restOnly, new Set()),
    ).toEqual({ takenDueDays: 0, totalDueDays: 0 });
  });
});
