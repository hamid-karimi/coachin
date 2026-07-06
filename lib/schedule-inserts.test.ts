import { describe, it, expect } from "vitest";

import { buildScheduleInserts } from "./schedule-inserts";

const base = { userId: "user-1", sportTypeId: 42 };

describe("buildScheduleInserts", () => {
  it("fans out one row per day across multiple days", () => {
    const rows = buildScheduleInserts({ ...base, days: [1, 3, 5] });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.day_of_week)).toEqual([1, 3, 5]);
    expect(rows.every((r) => r.user_id === "user-1")).toBe(true);
    expect(rows.every((r) => r.sport_type_id === 42)).toBe(true);
  });

  it("dedupes repeated days", () => {
    const rows = buildScheduleInserts({ ...base, days: [2, 2, 4, 2] });
    expect(rows.map((r) => r.day_of_week)).toEqual([2, 4]);
  });

  it("drops days outside 0-6 and non-integers", () => {
    const rows = buildScheduleInserts({ ...base, days: [0, 6, 7, -1, 3.5] });
    expect(rows.map((r) => r.day_of_week)).toEqual([0, 6]);
  });

  it("normalizes empty/whitespace time and endsOn to null", () => {
    const rows = buildScheduleInserts({
      ...base,
      days: [1],
      time: "  ",
      endsOn: "",
    });
    expect(rows[0].time).toBeNull();
    expect(rows[0].ends_on).toBeNull();
  });

  it("passes through provided time and endsOn", () => {
    const rows = buildScheduleInserts({
      ...base,
      days: [1],
      time: "07:30",
      endsOn: "2026-12-31",
    });
    expect(rows[0].time).toBe("07:30");
    expect(rows[0].ends_on).toBe("2026-12-31");
  });

  it("returns [] for an empty day list", () => {
    expect(buildScheduleInserts({ ...base, days: [] })).toEqual([]);
  });

  it("returns [] when every day is invalid", () => {
    expect(buildScheduleInserts({ ...base, days: [7, -3, 99] })).toEqual([]);
  });
});
