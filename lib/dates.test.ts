import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  daysUntil,
  lastElapsedPlanWeek,
  mondayOf,
  planItemDate,
  planWeekForDate,
  planWeekOf,
  toLocalYMD,
  weeksSince,
  yearsSince,
} from "./dates";

// 2026-07-06 is a Monday.
const NOW = new Date("2026-07-06T10:00:00");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toLocalYMD", () => {
  it("formats with zero-padded month and day", () => {
    expect(toLocalYMD(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("mondayOf", () => {
  it("returns the same day for a Monday", () => {
    expect(toLocalYMD(mondayOf(new Date("2026-07-06T15:00:00")))).toBe(
      "2026-07-06",
    );
  });

  it("returns the previous Monday for a Sunday", () => {
    expect(toLocalYMD(mondayOf(new Date("2026-07-12T00:00:00")))).toBe(
      "2026-07-06",
    );
  });
});

describe("yearsSince", () => {
  it("computes whole years", () => {
    expect(yearsSince("1990-07-01")).toBe(36);
  });

  it("returns null for missing or invalid input", () => {
    expect(yearsSince(null)).toBeNull();
    expect(yearsSince("not-a-date")).toBeNull();
  });
});

describe("weeksSince / planWeekOf / lastElapsedPlanWeek", () => {
  it("is week 1 during the first plan week", () => {
    expect(weeksSince("2026-07-05T09:00:00")).toBe(0);
    expect(planWeekOf("2026-07-05T09:00:00", 12)).toBe(1);
    expect(lastElapsedPlanWeek("2026-07-05T09:00:00", 12)).toBe(0);
  });

  it("clamps the current week to the plan length", () => {
    expect(planWeekOf("2026-01-01T00:00:00", 4)).toBe(4);
  });
});

describe("daysUntil", () => {
  it("counts days to a future date and floors past dates at 0", () => {
    expect(daysUntil("2026-07-10")).toBe(4);
    expect(daysUntil("2026-07-01")).toBe(0);
  });
});

describe("planWeekForDate", () => {
  const createdAt = "2026-07-01T12:00:00"; // Wednesday → week 1 Monday is Jun 29

  it("puts dates in the creation week into week 1", () => {
    expect(planWeekForDate(createdAt, new Date("2026-06-29T00:00:00"))).toBe(1);
    expect(planWeekForDate(createdAt, new Date("2026-07-05T00:00:00"))).toBe(1);
  });

  it("advances at the Monday boundary", () => {
    expect(planWeekForDate(createdAt, new Date("2026-07-06T00:00:00"))).toBe(2);
  });

  it("goes out of range before the plan started", () => {
    expect(planWeekForDate(createdAt, new Date("2026-06-28T00:00:00"))).toBe(0);
  });
});

describe("planItemDate", () => {
  const createdAt = "2026-07-01T12:00:00"; // week 1 Monday is Jun 29

  it("maps week/day to a calendar date, Monday-anchored", () => {
    expect(toLocalYMD(planItemDate(createdAt, 1, 1))).toBe("2026-06-29"); // Mon wk1
    expect(toLocalYMD(planItemDate(createdAt, 1, 0))).toBe("2026-07-05"); // Sun wk1
    expect(toLocalYMD(planItemDate(createdAt, 2, 3))).toBe("2026-07-08"); // Wed wk2
  });

  it("round-trips with planWeekForDate", () => {
    const date = planItemDate(createdAt, 3, 5);
    expect(planWeekForDate(createdAt, date)).toBe(3);
  });
});
