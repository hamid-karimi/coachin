import { describe, expect, it } from "vitest";
import { EMPTY_SESSION_LOG, isLoggable, sessionLogBody, sessionLogReducer } from "./session-log";

describe("sessionLogReducer", () => {
  it("toggles the RPE and sets fields", () => {
    let draft = sessionLogReducer(EMPTY_SESSION_LOG, {
      type: "toggle_rpe",
      value: 7,
    });
    expect(draft.rpe).toBe(7);
    draft = sessionLogReducer(draft, { type: "toggle_rpe", value: 7 });
    expect(draft.rpe).toBeNull();
    draft = sessionLogReducer(draft, {
      type: "set",
      field: "distanceKm",
      value: "10.5",
    });
    expect(draft.distanceKm).toBe("10.5");
  });
});

describe("sessionLogBody", () => {
  it("keeps only positive run numbers and a trimmed note", () => {
    const draft = {
      rpe: 6,
      note: "  easy ",
      distanceKm: "10.5",
      durationMin: "0",
      avgHr: "abc",
    };
    expect(sessionLogBody("run", draft, [])).toEqual({
      sport: "run",
      rpe: 6,
      note: "easy",
      distanceKm: 10.5,
      durationMin: undefined,
      avgHr: undefined,
    });
  });

  it("sends filled strength rows only", () => {
    const exercises = [
      { name: "Squat", sets: [{ weight_kg: "100", reps: "5" }] },
      { name: "", sets: [{ weight_kg: "", reps: "" }] },
    ];
    expect(sessionLogBody("strength", EMPTY_SESSION_LOG, exercises)).toEqual({
      sport: "strength",
      rpe: undefined,
      note: undefined,
      exercises: [{ name: "Squat", sets: [{ weight_kg: 100, reps: 5 }] }],
    });
    expect(sessionLogBody("strength", EMPTY_SESSION_LOG, exercises.slice(1))).not.toHaveProperty("exercises");
  });
});

describe("isLoggable", () => {
  it("allows runs and strength only", () => {
    expect(["run", "strength", "stretch", "meal_note"].map(isLoggable)).toEqual([true, true, false, false]);
  });
});
