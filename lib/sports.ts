import type { Sport } from "@/components/design-system/sport-chip";

/**
 * Map a free-form `sport_types.name` to the design-system `Sport` union.
 * Lowercases/trims the input and matches common substrings. Unknown,
 * null, or undefined names fall back to "mobility" (the generic Activity
 * icon) so this never throws.
 */
export function sportFromName(name?: string | null): Sport {
  const value = (name ?? "").toLowerCase().trim();

  if (value.includes("run")) return "running";
  if (
    value.includes("strength") ||
    value.includes("gym") ||
    value.includes("weight") ||
    value.includes("lift")
  ) {
    return "strength";
  }
  if (value.includes("swim")) return "swimming";
  if (value.includes("bike") || value.includes("cycl")) return "cycling";
  if (
    value.includes("yoga") ||
    value.includes("mobil") ||
    value.includes("stretch") ||
    value.includes("pilates")
  ) {
    return "mobility";
  }

  return "mobility";
}
