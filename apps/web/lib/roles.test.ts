import { describe, expect, it } from "vitest";
import { canCoach, canTrain, homeFor } from "./roles";

describe("roles", () => {
  it("lands pure coaches on /coaching and everyone else on /dashboard", () => {
    expect(homeFor("coach")).toBe("/coaching");
    for (const role of ["student", "both", "admin", null, undefined, "unknown"]) {
      expect(homeFor(role)).toBe("/dashboard");
    }
  });

  it("lets coach, both, and admin coach", () => {
    expect(["coach", "both", "admin"].every(canCoach)).toBe(true);
    expect(["student", null, undefined].some(canCoach)).toBe(false);
  });

  it("lets students, both, and admins have a coach", () => {
    expect(["student", "both", "admin", null].every(canTrain)).toBe(true);
    expect(canTrain("coach")).toBe(false);
  });
});
