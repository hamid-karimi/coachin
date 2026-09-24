import { describe, expect, it } from "vitest";
import { isNavVisible, keyFromPath, NAV_ROUTES } from "./nav";

describe("nav", () => {
  it.each([
    ["/dashboard", "home"],
    ["/", "home"],
    [null, "home"],
    ["/training/new", "training"],
    ["/onboarding", "training"],
    ["/coaching/trainees/1", "coaching"],
    ["/profile", "profile"],
  ] as const)("%s highlights %s", (path, key) => {
    expect(keyFromPath(path)).toBe(key);
  });

  it("gates coaching on the role and community on the flag", () => {
    const none = { coachNav: false, communityNav: false };
    expect(isNavVisible("coaching", none)).toBe(false);
    expect(isNavVisible("community", none)).toBe(false);
    expect(isNavVisible("home", none)).toBe(true);
    expect(isNavVisible("coaching", { ...none, coachNav: true })).toBe(true);
    expect(isNavVisible("community", { ...none, communityNav: true })).toBe(true);
  });

  it("routes home to the dashboard", () => {
    expect(NAV_ROUTES.home).toBe("/dashboard");
  });
});
