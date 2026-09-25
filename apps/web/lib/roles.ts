/**
 * Role gates. `profiles.role` is `student | coach | both | admin`;
 * "trainee" is UI copy only — code and data keep "student".
 */
const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
const TRAINEE_ENABLED_ROLES = new Set(["student", "both", "admin"]);

export function canCoach(role: string | null | undefined): boolean {
  return COACH_ENABLED_ROLES.has(role ?? "");
}

/** Roles that can have a coach (redeem invite codes). */
export function canTrain(role: string | null | undefined): boolean {
  return TRAINEE_ENABLED_ROLES.has(role ?? "student");
}

/** Post-login landing: pure coaches live in /coaching, everyone else in /dashboard. */
export function homeFor(role: string | null | undefined): string {
  return role === "coach" ? "/coaching" : "/dashboard";
}
