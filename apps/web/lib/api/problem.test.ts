import { describe, expect, it } from "vitest";
import { problemMessage } from "./problem";

describe("problemMessage", () => {
  it("prefers the detail", () => {
    expect(problemMessage({ title: "Unauthorized", detail: "Invalid login credentials" })).toBe(
      "Invalid login credentials",
    );
  });

  it("falls back to the title, then the default", () => {
    expect(problemMessage({ title: "Too Many Requests", detail: "  " })).toBe("Too Many Requests");
    expect(problemMessage(undefined)).toBe("Something went wrong. Please try again.");
    expect(problemMessage("boom", "Custom")).toBe("Custom");
  });
});
