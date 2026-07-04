import type { Tier } from "@/components/design-system/tier-badge";

const TIERS: readonly Tier[] = ["bronze", "silver", "gold", "platinum"];

/**
 * Map the real `profiles.league_tier` string onto the DS `TierBadge`
 * `Tier` union. Unknown or missing values fall back to `"bronze"`.
 */
export function tierFromLeague(leagueTier?: string | null): Tier {
  const normalized = leagueTier?.toLowerCase().trim();
  return TIERS.find((tier) => tier === normalized) ?? "bronze";
}
