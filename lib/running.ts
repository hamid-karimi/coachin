/** Pure running math (client-safe) — roadmap branch 4. */

/**
 * Riegel race-time prediction: t2 = t1 * (d2/d1)^1.06.
 * Standard endurance exponent; good enough for goal suggestions.
 */
export function riegelSeconds(
  knownDistanceKm: number,
  knownSeconds: number,
  targetDistanceKm: number,
): number {
  if (knownDistanceKm <= 0 || knownSeconds <= 0 || targetDistanceKm <= 0) {
    return 0;
  }
  return Math.round(
    knownSeconds * Math.pow(targetDistanceKm / knownDistanceKm, 1.06),
  );
}

/** "4:05" → 245s, "3:59:30" → 14370s. Returns null when unparsable. */
export function parseTimeToSeconds(value: string): number | null {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

/** 14370 → "3:59:30"; 245 → "4:05". */
export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(rest).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const RACE_DISTANCES_KM = {
  pb_5k: 5,
  pb_10k: 10,
  pb_half: 21.0975,
  pb_full: 42.195,
} as const;

/**
 * Suggest a marathon goal time from the longest-distance PB available
 * (longer efforts predict better). Returns formatted "h:mm:ss" or null.
 */
export function suggestMarathonGoal(pbs: {
  pb_5k?: string;
  pb_10k?: string;
  pb_half?: string;
  pb_full?: string;
}): string | null {
  const order: (keyof typeof RACE_DISTANCES_KM)[] = [
    "pb_full",
    "pb_half",
    "pb_10k",
    "pb_5k",
  ];
  for (const key of order) {
    const raw = pbs[key];
    if (!raw) continue;
    const seconds = parseTimeToSeconds(raw);
    if (!seconds) continue;
    if (key === "pb_full") return formatSeconds(seconds);
    return formatSeconds(
      riegelSeconds(RACE_DISTANCES_KM[key], seconds, RACE_DISTANCES_KM.pb_full),
    );
  }
  return null;
}
