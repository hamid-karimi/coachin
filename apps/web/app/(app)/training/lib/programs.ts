import type { components } from "@/lib/api/schema";
import { planTitleFor } from "@/lib/plan-title";

export type Program = components["schemas"]["ProgramBody"];

/** "Race in 10 days · Week 3 of 16 · goal 3:59" (legacy card meta line). */
export function programMeta(program: Program): string {
  return [
    program.daysUntilRace !== null ? `Race in ${program.daysUntilRace} days` : null,
    `Week ${program.currentWeek} of ${program.weeksTotal}`,
    program.goalTime ? `goal ${program.goalTime}` : null,
    program.planKind === "hypertrophy" ? "progressive overload" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function programTitle(program: Program): string {
  return planTitleFor(program.planKind, program.raceTarget, program.raceDistanceKm);
}
