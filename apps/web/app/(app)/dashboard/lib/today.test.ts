import { describe, expect, it } from "vitest";
import { dateLabel, firstName, initials, levelPercent, multiplierSuffix, planCardSubtitle, plural } from "./today";

describe("today copy", () => {
  it("greets by first name and builds initials", () => {
    expect(firstName("Ada Lovelace")).toBe("Ada");
    expect(firstName("  ")).toBe("athlete");
    expect(initials("ada byron lovelace")).toBe("AB");
    expect(initials("x")).toBe("X");
  });

  it("labels the API date without shifting the day", () => {
    expect(dateLabel("2026-09-24")).toBe("Thursday, September 24");
  });

  it("derives level fill, plurals, plan card, multiplier", () => {
    expect(levelPercent(500, 1000)).toBe(50);
    expect(levelPercent(0, 0)).toBe(0);
    expect(plural(1, "heart")).toBe("1 heart");
    expect(plural(2, "heart")).toBe("2 hearts");
    expect(planCardSubtitle(1, 0)).toBe("rest day");
    expect(planCardSubtitle(2, 1)).toBe("2 active · 1 item today");
    expect(multiplierSuffix(1)).toBe("");
    expect(multiplierSuffix(1.2)).toBe(" (1.2×)");
  });
});
