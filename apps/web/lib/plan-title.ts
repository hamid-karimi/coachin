/** Discipline of a training plan (mirrors the `plan_kind` column). */
export type PlanKind = "race" | "hypertrophy";

const RACE_TARGET_TITLES: Record<string, (km?: number | null) => string> = {
  base: () => "Running plan",
  "5k": () => "5k plan",
  "10k": () => "10k plan",
  half: () => "Half marathon plan",
  full: () => "Marathon plan",
  ultra: (km) => `Ultra plan${km ? ` (${km}km)` : ""}`,
  other: (km) => `${km ?? "?"}km race plan`,
};

/**
 * Human title for a training plan from its kind and running race target.
 * Hypertrophy → "Muscle building plan"; unknown running targets fall back to
 * "Marathon plan".
 */
export function planTitleFor(
  planKind: string | null | undefined,
  raceTarget?: string | null,
  raceDistanceKm?: number | null,
): string {
  if (planKind === "hypertrophy") return "Muscle building plan";
  const make = RACE_TARGET_TITLES[raceTarget ?? "full"];
  return make ? make(raceDistanceKm) : "Marathon plan";
}
