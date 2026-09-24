import { describe, expect, it } from "vitest";
import { dueChecklist, SCHEDULE_WEEKDAYS, scheduleBody, toggleDay, type Supplement } from "./supplements";

const supplement = (over: Partial<Supplement>): Supplement => ({
  id: "1",
  name: "Creatine",
  dose: null,
  scheduleType: "daily",
  daysOfWeek: [],
  scheduleLabel: "Every day",
  dueToday: true,
  takenToday: false,
  ...over,
});

describe("supplements", () => {
  it("lists weekdays Sunday-first", () => {
    expect(SCHEDULE_WEEKDAYS.map((d) => d.short)).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  });

  it("toggles days in order", () => {
    expect(toggleDay([1, 5], 3)).toEqual([1, 3, 5]);
    expect(toggleDay([1, 3, 5], 3)).toEqual([1, 5]);
  });

  it("drops days unless the schedule is custom", () => {
    expect(scheduleBody({ scheduleType: "daily", daysOfWeek: [1] })).toEqual({ scheduleType: "daily", daysOfWeek: [] });
    expect(scheduleBody({ scheduleType: "custom", daysOfWeek: [1] })).toEqual({ scheduleType: "custom", daysOfWeek: [1] });
  });

  it("counts only supplements due today", () => {
    const stack = [
      supplement({ id: "a", takenToday: true }),
      supplement({ id: "b" }),
      supplement({ id: "c", dueToday: false, takenToday: true }),
    ];
    const { due, taken } = dueChecklist(stack);
    expect(due.map((s) => s.id)).toEqual(["a", "b"]);
    expect(taken).toBe(1);
  });
});
