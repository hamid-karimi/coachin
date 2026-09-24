/** Discipline of a training plan (mirrors the `plan_kind` column). */
export type PlanKind = "race" | "hypertrophy";

type TitleIntake = {
  plan_kind?: string;
  race_target?: string;
  race_distance_km?: number;
};

const RACE_TARGET_TITLES: Record<string, (km?: number) => string> = {
  base: () => "Running plan",
  "5k": () => "5k plan",
  "10k": () => "10k plan",
  half: () => "Half marathon plan",
  full: () => "Marathon plan",
  ultra: (km) => `Ultra plan${km ? ` (${km}km)` : ""}`,
  other: (km) => `${km ?? "?"}km race plan`,
};

/**
 * Human title for a training plan, derived from `plan_kind` and the running
 * `race_target` in `intake`. Hypertrophy → "Muscle building plan";
 * running falls back to "Marathon plan" for unknown targets.
 */
export function planTitleFor(
  planKind: string | null | undefined,
  intake: TitleIntake | null | undefined,
): string {
  if (planKind === "hypertrophy" || intake?.plan_kind === "hypertrophy") {
    return "Muscle building plan";
  }
  const target = intake?.race_target ?? "full";
  const make = RACE_TARGET_TITLES[target];
  return make ? make(intake?.race_distance_km) : "Marathon plan";
}
