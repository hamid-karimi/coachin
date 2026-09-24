import type { Sport } from "@/components/design-system/sport-chip";

/**
 * Keyword → Sport lookup, first match wins. Order matters: more specific
 * buckets sit above broader ones so e.g. "Kickboxing" hits combat before
 * anything else. Keep every keyword lowercase — input is lowercased first.
 */
const SPORT_KEYWORDS: ReadonlyArray<readonly [Sport, readonly string[]]> = [
  ["running", ["run"]],
  ["strength", ["strength", "gym", "weight", "lift"]],
  ["swimming", ["swim"]],
  ["cycling", ["bike", "cycl"]],
  [
    "ball_sports",
    [
      "football",
      "soccer",
      "basketball",
      "tennis",
      "volleyball",
      "badminton",
      "handball",
    ],
  ],
  ["combat", ["boxing", "martial", "mma", "karate", "judo", "taekwondo"]],
  ["climbing", ["climb", "boulder"]],
  ["outdoor", ["hik", "trek"]],
  ["rowing", ["row", "kayak", "paddle"]],
  ["dance", ["danc"]],
  ["mobility", ["yoga", "mobil", "stretch", "pilates"]],
];

/**
 * Map a free-form `sport_types.name` to the design-system `Sport` union.
 * Lowercases/trims the input and matches common substrings. Unknown,
 * null, or undefined names fall back to "mobility" (the generic Activity
 * icon) so this never throws.
 */
export function sportFromName(name?: string | null): Sport {
  const value = (name ?? "").toLowerCase().trim();

  for (const [sport, keywords] of SPORT_KEYWORDS) {
    if (keywords.some((keyword) => value.includes(keyword))) return sport;
  }

  return "mobility";
}
