import { describe, expect, it } from "vitest";
import { calendarQuery, dayLabel, isRestDay, routineLabel, weekLabel } from "./calendar";

describe("calendar", () => {
  it("builds the same query options on both sides", () => {
    expect(calendarQuery("2026-09-21")).toEqual({ params: { query: { week: "2026-09-21" } } });
    expect(calendarQuery(null)).toEqual({ params: { query: {} } });
    expect(calendarQuery("")).toEqual({ params: { query: {} } });
  });

  it("labels weeks and days", () => {
    expect(weekLabel({ weekStart: "2026-09-28", weekEnd: "2026-10-04" })).toBe("Sep 28 – Oct 4");
    expect(dayLabel("2026-09-24")).toBe("Thursday, Sep 24");
  });

  it("labels routine sessions", () => {
    expect(routineLabel({ sportName: "Running", time: "07:00" })).toBe("Running · 07:00");
    expect(routineLabel({ sportName: null, time: null })).toBe("Workout");
  });

  it("spots rest days", () => {
    expect(isRestDay({ routines: [], planItems: [] })).toBe(true);
    expect(
      isRestDay({ routines: [{ sportTypeId: 1, sportName: "Gym", time: null, done: false }], planItems: [] }),
    ).toBe(false);
  });
});
