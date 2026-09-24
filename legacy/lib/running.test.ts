import { describe, expect, it } from "vitest";

import { BASE_WEEKS_DEFAULT, clampBaseWeeks } from "./running";

describe("clampBaseWeeks", () => {
  it("keeps in-range values", () => {
    expect(clampBaseWeeks(6)).toBe(6);
    expect(clampBaseWeeks(8)).toBe(8);
    expect(clampBaseWeeks(12)).toBe(12);
  });

  it("clamps below 4 up to 4 and above 24 down to 24", () => {
    expect(clampBaseWeeks(1)).toBe(4);
    expect(clampBaseWeeks(0)).toBe(4);
    expect(clampBaseWeeks(100)).toBe(24);
  });

  it("rounds fractional weeks", () => {
    expect(clampBaseWeeks(8.4)).toBe(8);
    expect(clampBaseWeeks(11.6)).toBe(12);
  });

  it("falls back to the default for missing or invalid input", () => {
    expect(clampBaseWeeks(undefined)).toBe(BASE_WEEKS_DEFAULT);
    expect(clampBaseWeeks(null)).toBe(BASE_WEEKS_DEFAULT);
    expect(clampBaseWeeks("")).toBe(BASE_WEEKS_DEFAULT);
    expect(clampBaseWeeks("abc")).toBe(BASE_WEEKS_DEFAULT);
    expect(clampBaseWeeks(NaN)).toBe(BASE_WEEKS_DEFAULT);
  });

  it("parses numeric strings (FormData values)", () => {
    expect(clampBaseWeeks("12")).toBe(12);
  });
});
