import { describe, expect, it } from "vitest";
import { isProtectedPath, sessionRedirect } from "./session-routing";

describe("session routing", () => {
  it.each(["/dashboard", "/profile", "/coaching/trainees/1", "/onboarding"])("%s is protected", (path) => {
    expect(isProtectedPath(path)).toBe(true);
  });

  it.each(["/", "/auth/login", "/status", "/profiles-public", "/dashboards"])("%s is public", (path) => {
    expect(isProtectedPath(path)).toBe(false);
  });

  it("sends visitors without a cookie to sign in", () => {
    expect(sessionRedirect("/dashboard", false)).toBe("/auth/login");
    expect(sessionRedirect("/dashboard", true)).toBeNull();
    expect(sessionRedirect("/auth/login", false)).toBeNull();
  });
});
