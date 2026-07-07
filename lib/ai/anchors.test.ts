import { describe, expect, it } from "vitest";
import { anchorsPromptBlock, type PlanAnchor } from "./anchors";

const climbing = (day_of_week: number, time: string | null): PlanAnchor => ({
  day_of_week,
  time,
  sport: "Rock Climbing",
});

describe("anchorsPromptBlock", () => {
  it("returns an empty string when there are no anchors", () => {
    expect(anchorsPromptBlock([])).toBe("");
  });

  it("renders day short name, HH:MM time, and sport per slot", () => {
    const block = anchorsPromptBlock([climbing(2, "19:00:00")]);
    expect(block).toContain("[Tue 19:00 Rock Climbing]");
    expect(block).toContain("fixed weekly commitments");
    expect(block).toContain("Do not schedule plan sessions that conflict");
    expect(block).toContain("avoid scheduling HARD sessions");
  });

  it("omits the time when the anchor has none", () => {
    expect(anchorsPromptBlock([climbing(6, null)])).toContain(
      "[Sat Rock Climbing]",
    );
  });

  it("sorts slots Monday-first regardless of input order", () => {
    const block = anchorsPromptBlock([
      climbing(0, "10:00"), // Sunday — last in a Monday-first week
      climbing(6, "19:00"),
      climbing(2, "19:00"),
    ]);
    expect(block).toContain(
      "[Tue 19:00 Rock Climbing, Sat 19:00 Rock Climbing, Sun 10:00 Rock Climbing]",
    );
  });
});
