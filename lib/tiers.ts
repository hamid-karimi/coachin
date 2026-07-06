import type { Tier } from "@/components/design-system/tier-badge";

const TIERS: readonly Tier[] = ["bronze", "silver", "gold", "platinum"];

/**
 * Lifetime-XP thresholds for each league tier (cumulative — a tier is reached
 * at this XP and never lost). Mirrors league_tier_for_xp in the DB trigger;
 * FORMULAS.md §3 is the source of truth. Keep all three in sync.
 */
export const LEAGUE_TIER_MIN_XP: Record<Tier, number> = {
  bronze: 0,
  silver: 5000,
  gold: 20000,
  platinum: 50000,
};

/** League tier from lifetime XP (cumulative thresholds). */
export function leagueTierFromXp(xp: number): Tier {
  const safe = Number.isFinite(xp) && xp > 0 ? xp : 0;
  if (safe >= LEAGUE_TIER_MIN_XP.platinum) return "platinum";
  if (safe >= LEAGUE_TIER_MIN_XP.gold) return "gold";
  if (safe >= LEAGUE_TIER_MIN_XP.silver) return "silver";
  return "bronze";
}

/**
 * Map the stored `profiles.league_tier` string onto the DS `TierBadge`
 * `Tier` union. Unknown or missing values fall back to `"bronze"`.
 */
export function tierFromLeague(leagueTier?: string | null): Tier {
  const normalized = leagueTier?.toLowerCase().trim();
  return TIERS.find((tier) => tier === normalized) ?? "bronze";
}
