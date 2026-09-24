import { describe, expect, it } from "vitest";
import { programMeta, programTitle, type Program } from "./programs";

const base: Program = {
  id: "1",
  planKind: "race",
  raceTarget: "full",
  raceDistanceKm: 42.195,
  raceDate: "2026-11-01",
  goalTime: "3:59",
  weeksTotal: 16,
  currentWeek: 3,
  daysUntilRace: 38,
  fromCoach: false,
  reviewWeek: 2,
  checkinDue: false,
};

describe("programs", () => {
  it("builds the meta line", () => {
    expect(programMeta(base)).toBe("Race in 38 days · Week 3 of 16 · goal 3:59");
    expect(
      programMeta({ ...base, planKind: "hypertrophy", daysUntilRace: null, goalTime: null, raceTarget: null }),
    ).toBe("Week 3 of 16 · progressive overload");
  });

  it("titles the program", () => {
    expect(programTitle(base)).toBe("Marathon plan");
    expect(programTitle({ ...base, planKind: "hypertrophy" })).toBe("Muscle building plan");
  });
});
