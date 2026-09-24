import { describe, expect, it } from "vitest";
import {
  clampSessions,
  daysPlannedLabel,
  fixedSessionErrors,
  fixedSessionReducer,
  INITIAL_FIXED_SESSION,
  INITIAL_SHEET,
  plannedDays,
  sheetReducer,
} from "./commitments";

describe("sheetReducer", () => {
  it("starts fresh on open and advances when a sport is picked", () => {
    const stale = { ...INITIAL_SHEET, sportId: 3, step: "details" as const, commitmentType: "target" as const };
    const opened = sheetReducer(stale, { type: "open" });
    expect(opened).toEqual({ ...INITIAL_SHEET, open: true });
    expect(sheetReducer(opened, { type: "pick_sport", sportId: 2 })).toMatchObject({ sportId: 2, step: "details" });
  });

  it("clearing the pick stays on the sport step", () => {
    const opened = sheetReducer(INITIAL_SHEET, { type: "open" });
    expect(sheetReducer(opened, { type: "pick_sport", sportId: null })).toMatchObject({ sportId: null, step: "sport" });
  });

  it("goes back keeping the pick, switches type, and closes", () => {
    let state = sheetReducer({ ...INITIAL_SHEET, open: true }, { type: "pick_sport", sportId: 2 });
    state = sheetReducer(state, { type: "back" });
    expect(state).toMatchObject({ step: "sport", sportId: 2 });
    state = sheetReducer(state, { type: "set_commitment_type", value: "target" });
    expect(state.commitmentType).toBe("target");
    expect(sheetReducer(state, { type: "close" }).open).toBe(false);
  });
});

describe("fixedSessionReducer", () => {
  it("toggles the day and clears the day error only when one is picked", () => {
    const rejected = fixedSessionReducer(INITIAL_FIXED_SESSION, { type: "reject", dayError: "Pick", sportError: null });
    const picked = fixedSessionReducer(rejected, { type: "toggle_day", day: 3 });
    expect(picked).toMatchObject({ dayOfWeek: 3, dayError: null });
    const unpicked = fixedSessionReducer({ ...picked, dayError: "Pick" }, { type: "toggle_day", day: 3 });
    expect(unpicked).toMatchObject({ dayOfWeek: null, dayError: "Pick" });
  });

  it("tracks time and end date, and resets", () => {
    let state = fixedSessionReducer(INITIAL_FIXED_SESSION, { type: "set_time", value: "07:00" });
    state = fixedSessionReducer(state, { type: "set_ends_on", value: "2026-12-31" });
    expect(state).toMatchObject({ time: "07:00", endsOn: "2026-12-31" });
    expect(fixedSessionReducer(state, { type: "reset" })).toEqual(INITIAL_FIXED_SESSION);
  });
});

describe("fixedSessionErrors", () => {
  it("points at what is missing", () => {
    expect(fixedSessionErrors(null, null)).toEqual({ sportError: "Pick a sport first", dayError: "Pick at least one day" });
    expect(fixedSessionErrors(1, null)).toEqual({ sportError: null, dayError: "Pick at least one day" });
    expect(fixedSessionErrors(1, 0)).toBeNull();
  });
});

describe("derivations", () => {
  it("clamps sessions per week to 1–14", () => {
    expect([clampSessions(0), clampSessions(5), clampSessions(20)]).toEqual([1, 5, 14]);
  });

  it("lists distinct planned days and labels them", () => {
    expect(plannedDays([{ dayOfWeek: 1 }, { dayOfWeek: 3 }, { dayOfWeek: 1 }])).toEqual([1, 3]);
    expect(daysPlannedLabel(1)).toBe("1 day planned");
    expect(daysPlannedLabel(3)).toBe("3 days planned");
  });
});
