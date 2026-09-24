/**
 * Feature flags. NEXT_PUBLIC_ so the same switch works in server pages,
 * route handlers, AND client nav components (inlined at build time — flipping
 * a flag on Vercel requires a redeploy, which happens on every env change).
 */

/**
 * Community surfaces (boards, circle, clubs, groups, discover) are
 * temporarily disabled — owner decision 2026-07-10: users shouldn't see each
 * other for now. ALL community code is kept intact; re-enable by setting
 * `NEXT_PUBLIC_FEATURE_COMMUNITY=on` in the environment. While off, the
 * coach invite-code form (normally in /community/circle) renders on the
 * profile page instead so trainees can still join their coach.
 */
export function isCommunityEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_COMMUNITY === "on";
}
