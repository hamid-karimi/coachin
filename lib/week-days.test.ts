import { describe, expect, it } from "vitest";

import { WEEK_DAYS, weekDayOf } from "./week-days";

describe("week-days", () => {
  it("covers all seven days, Monday-first", () => {
    expect(WEEK_DAYS).toHaveLength(7);
    expect(WEEK_DAYS.map((d) => d.short)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
  });

  it("keeps real 0-6 ids so Sunday stays 0", () => {
    expect(weekDayOf(0)?.name).toBe("Sunday");
    expect(weekDayOf(3)?.name).toBe("Wednesday");
    expect(weekDayOf(6)?.short).toBe("Sat");
  });

  it("returns undefined for out-of-range ids", () => {
    expect(weekDayOf(9)).toBeUndefined();
    expect(weekDayOf(-1)).toBeUndefined();
  });
});
