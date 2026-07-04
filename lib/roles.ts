/**
 * Role gates shared by server pages, layouts, and actions.
 *
 * `profiles.role` values in use: `student | coach | both | admin`.
 * "Trainee" is UI copy only — code/DB identifiers keep "student".
 */
export const COACH_ENABLED_ROLES = new Set(["coach", "both", "admin"]);
export const STUDENT_ENABLED_ROLES = new Set(["student", "both", "admin"]);

export function canCoach(role: string | null | undefined): boolean {
  return COACH_ENABLED_ROLES.has(role ?? "");
}

export function canStudy(role: string | null | undefined): boolean {
  return STUDENT_ENABLED_ROLES.has(role ?? "");
}

/** Post-login landing: pure coaches live in /coaching, everyone else in /dashboard. */
export function homeFor(role: string | null | undefined): string {
  return role === "coach" ? "/coaching" : "/dashboard";
}
