/** Primary navigation: one key per top-level surface. */
export type NavKey = "home" | "training" | "calendar" | "nutrition" | "community" | "coaching" | "profile";

export const NAV_ROUTES: Record<NavKey, string> = {
  home: "/dashboard",
  training: "/training",
  calendar: "/calendar",
  nutrition: "/nutrition",
  community: "/community",
  coaching: "/coaching",
  profile: "/profile",
};

/**
 * Path prefix → highlighted tab, first match wins. The routine editor
 * (/onboarding) belongs to the Training surface.
 */
const ACTIVE_BY_PREFIX: [prefix: string, key: NavKey][] = [
  ["/training", "training"],
  ["/onboarding", "training"],
  ["/calendar", "calendar"],
  ["/nutrition", "nutrition"],
  ["/community", "community"],
  ["/coaching", "coaching"],
  ["/profile", "profile"],
];

export function keyFromPath(pathname: string | null): NavKey {
  const match = ACTIVE_BY_PREFIX.find(([prefix]) => pathname?.startsWith(prefix));
  return match ? match[1] : "home";
}

export type NavVisibility = {
  /** Viewer can coach (lib/roles canCoach), decided on the server. */
  coachNav: boolean;
  /** The community feature flag, from GET /me. */
  communityNav: boolean;
};

const GATES: Partial<Record<NavKey, (v: NavVisibility) => boolean>> = {
  coaching: (v) => v.coachNav,
  community: (v) => v.communityNav,
};

/** Whether a tab shows for this viewer. */
export function isNavVisible(key: NavKey, visibility: NavVisibility): boolean {
  return GATES[key]?.(visibility) ?? true;
}
