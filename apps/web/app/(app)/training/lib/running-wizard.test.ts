import { describe, expect, it } from "vitest";
import {
  hasAnyPb,
  INITIAL_RUNNING_DRAFT,
  planLabel,
  runningBody,
  runningDraftReducer,
  suggestedGoal,
  targetKm,
} from "./running-wizard";

describe("running wizard", () => {
  it("sets fields and PBs", () => {
    let draft = runningDraftReducer(INITIAL_RUNNING_DRAFT, { type: "set", field: "mode", value: "race" });
    draft = runningDraftReducer(draft, { type: "set_pb", key: "pb_10k", value: "48:00" });
    expect(draft.mode).toBe("race");
    expect(draft.pbs.pb_10k).toBe("48:00");
    expect(INITIAL_RUNNING_DRAFT.pbs.pb_10k).toBe("");
  });

  it("derives the target distance, PBs, and label", () => {
    const race = { ...INITIAL_RUNNING_DRAFT, mode: "race" as const, raceTarget: "half" as const };
    expect(targetKm(race)).toBe(21.0975);
    expect(targetKm({ ...race, raceTarget: "ultra", customKm: "" })).toBeNull();
    expect(targetKm({ ...race, raceTarget: "ultra", customKm: "50" })).toBe(50);
    expect(hasAnyPb(race)).toBe(false);
    expect(planLabel(race)).toBe("half marathon");
    expect(planLabel(INITIAL_RUNNING_DRAFT)).toBe("running");
  });

  it("suggests a goal from PBs", () => {
    const race = { ...INITIAL_RUNNING_DRAFT, mode: "race" as const, raceTarget: "10k" as const };
    expect(suggestedGoal(race)).toBeNull();
    expect(suggestedGoal({ ...race, pbs: { ...race.pbs, pb_5k: "25:00" } })).toMatch(/^\d+:\d{2}$/);
  });

  it("builds the request body per mode", () => {
    const base = runningBody({ ...INITIAL_RUNNING_DRAFT, weeklyKm: " 30 ", longestRunKm: "" });
    expect(base).toMatchObject({ mode: "base", baseWeeks: 8, weeklyKm: 30, daysPerWeek: 4 });
    expect(base.longestRunKm).toBeUndefined();
    expect(base.raceDate).toBeUndefined();

    const race = runningBody(
      { ...INITIAL_RUNNING_DRAFT, mode: "race", raceTarget: "other", customKm: "25", raceDate: "2027-01-10" },
      "student-1",
    );
    expect(race).toMatchObject({ mode: "race", raceTarget: "other", customDistanceKm: 25, raceDate: "2027-01-10", targetStudentId: "student-1" });
    expect(race.baseWeeks).toBeUndefined();
    expect(race.activities).toBeUndefined();
  });

  it("adds parsed watch runs in the intake shape", () => {
    const run = { date: "2026-09-20", distanceKm: 5, durationMin: 25, avgPaceMinKm: 5, avgHr: null, source: "gpx" as const };
    expect(runningBody(INITIAL_RUNNING_DRAFT, undefined, [run]).activities).toEqual([
      { date: "2026-09-20", distance_km: 5, duration_min: 25, avg_pace_min_km: 5, avg_hr: null, source: "gpx" },
    ]);
  });
});
