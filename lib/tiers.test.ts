import { describe, expect, it } from "vitest";

import { LEAGUE_TIER_MIN_XP, leagueTierFromXp, tierFromLeague } from "./tiers";

describe("leagueTierFromXp", () => {
  it("maps XP onto the right tier at and above each threshold", () => {
    expect(leagueTierFromXp(0)).toBe("bronze");
    expect(leagueTierFromXp(4999)).toBe("bronze");
    expect(leagueTierFromXp(LEAGUE_TIER_MIN_XP.silver)).toBe("silver");
    expect(leagueTierFromXp(19999)).toBe("silver");
    expect(leagueTierFromXp(LEAGUE_TIER_MIN_XP.gold)).toBe("gold");
    expect(leagueTierFromXp(49999)).toBe("gold");
    expect(leagueTierFromXp(LEAGUE_TIER_MIN_XP.platinum)).toBe("platinum");
    expect(leagueTierFromXp(1_000_000)).toBe("platinum");
  });

  it("treats invalid or negative XP as zero", () => {
    expect(leagueTierFromXp(-100)).toBe("bronze");
    expect(leagueTierFromXp(Number.NaN)).toBe("bronze");
  });
});

describe("tierFromLeague", () => {
  it("normalizes known tier strings", () => {
    expect(tierFromLeague("GOLD")).toBe("gold");
    expect(tierFromLeague(" platinum ")).toBe("platinum");
  });

  it("falls back to bronze for unknown or missing values", () => {
    expect(tierFromLeague(null)).toBe("bronze");
    expect(tierFromLeague("diamond")).toBe("bronze");
  });
});
