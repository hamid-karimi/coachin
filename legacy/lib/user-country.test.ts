import { describe, expect, it } from "vitest";

import { countryNameFromCode, resolveUserCountry } from "./user-country";

describe("countryNameFromCode", () => {
  it("decodes ISO-2 codes to English names", () => {
    expect(countryNameFromCode("IR")).toBe("Iran");
    expect(countryNameFromCode("de")).toBe("Germany");
    expect(countryNameFromCode(" us ")).toBe("United States");
  });

  it("returns null for junk, unknown codes, and empty input", () => {
    expect(countryNameFromCode("ZZ")).toBeNull();
    expect(countryNameFromCode("IRN")).toBeNull();
    expect(countryNameFromCode("1!")).toBeNull();
    expect(countryNameFromCode("")).toBeNull();
    expect(countryNameFromCode(null)).toBeNull();
  });
});

describe("resolveUserCountry", () => {
  it("prefers the profile value over the header", () => {
    expect(resolveUserCountry("Iran", "DE")).toBe("Iran");
  });

  it("falls back to the decoded header when the profile is empty", () => {
    expect(resolveUserCountry("", "IR")).toBe("Iran");
    expect(resolveUserCountry(null, "IR")).toBe("Iran");
    expect(resolveUserCountry("   ", "IR")).toBe("Iran");
  });

  it("returns null when neither source resolves", () => {
    expect(resolveUserCountry(null, null)).toBeNull();
    expect(resolveUserCountry("", "ZZ")).toBeNull();
  });

  it("caps overlong profile values", () => {
    expect(resolveUserCountry("x".repeat(100), null)).toHaveLength(56);
  });
});
