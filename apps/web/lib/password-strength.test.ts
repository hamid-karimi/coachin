import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password-strength";

describe("passwordStrength", () => {
  it.each([
    ["", 0],
    ["abc", 0],
    ["abcdefgh", 1],
    ["Abcdefgh", 2],
    ["Abcdefg1", 3],
    ["Abcdefg1!", 4],
    ["!", 1],
  ])("%j → %i", (password, expected) => {
    expect(passwordStrength(password)).toBe(expected);
  });
});
