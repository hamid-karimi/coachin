import { describe, expect, it } from "vitest";

import { sportFromName } from "./sports";

describe("sportFromName", () => {
  it.each([
    ["Running", "running"],
    ["Trail run", "running"],
    ["Strength", "strength"],
    ["Gym", "strength"],
    ["Weightlifting", "strength"],
    ["Swimming", "swimming"],
    ["Cycling", "cycling"],
    ["Mountain bike", "cycling"],
    ["Yoga", "mobility"],
    ["Pilates", "mobility"],
    ["Stretching", "mobility"],
    ["Mobility", "mobility"],
  ] as const)("keeps existing mapping: %s → %s", (name, sport) => {
    expect(sportFromName(name)).toBe(sport);
  });

  it.each([
    ["Football", "ball_sports"],
    ["Soccer", "ball_sports"],
    ["Basketball", "ball_sports"],
    ["Tennis", "ball_sports"],
    ["Table tennis", "ball_sports"],
    ["Volleyball", "ball_sports"],
    ["Badminton", "ball_sports"],
    ["Boxing", "combat"],
    ["Kickboxing", "combat"],
    ["Martial arts", "combat"],
    ["MMA", "combat"],
    ["Karate", "combat"],
    ["Judo", "combat"],
    ["Climbing", "climbing"],
    ["Rock climbing", "climbing"],
    ["Bouldering", "climbing"],
    ["Hiking", "outdoor"],
    ["Trekking", "outdoor"],
    ["Rowing", "rowing"],
    ["Kayaking", "rowing"],
    ["Dance", "dance"],
    ["Dancing", "dance"],
  ] as const)("maps new sport: %s → %s", (name, sport) => {
    expect(sportFromName(name)).toBe(sport);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(sportFromName("  fOoTbAll  ")).toBe("ball_sports");
  });

  it.each([["Quidditch"], ["Walking"], [""], [null], [undefined]])(
    "falls back to mobility for %s",
    (name) => {
      expect(sportFromName(name as string | null | undefined)).toBe("mobility");
    },
  );
});
