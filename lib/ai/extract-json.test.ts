import { describe, expect, it } from "vitest";

import { extractJson } from "./extract-json";

describe("extractJson", () => {
  it("returns null for empty or missing input", () => {
    expect(extractJson(null)).toBeNull();
    expect(extractJson(undefined)).toBeNull();
    expect(extractJson("   ")).toBeNull();
    expect(extractJson("no json here")).toBeNull();
  });

  it("passes through clean JSON objects and arrays", () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}');
    expect(extractJson("  [1, 2, 3]  ")).toBe("[1, 2, 3]");
  });

  it("unwraps ```json fenced blocks", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJson("```\n[1]\n```")).toBe("[1]");
  });

  it("slices JSON out of surrounding prose", () => {
    expect(extractJson('Here is the plan: {"a":1}. Done.')).toBe('{"a":1}');
  });

  it("keeps nested braces intact", () => {
    const json = '{"a":{"b":[1,2]},"c":3}';
    expect(extractJson(`prefix ${json} suffix`)).toBe(json);
  });

  it("returns null when there is no closing delimiter", () => {
    expect(extractJson("{ unterminated")).toBeNull();
  });
});
