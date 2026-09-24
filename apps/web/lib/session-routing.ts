/**
 * Optimistic routing on the session cookie alone (the proxy has no API
 * access). Pages still verify the session with GET /me; a stale cookie only
 * costs one extra redirect from the (app) layout.
 */
export const SESSION_COOKIES = ["coachin_session", "__Host-coachin_session"] as const;

const PROTECTED_PREFIXES = ["/dashboard", "/training", "/calendar", "/nutrition", "/community", "/coaching", "/profile", "/onboarding"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Where to send the request, or null to let it through. */
export function sessionRedirect(pathname: string, hasSessionCookie: boolean): string | null {
  return !hasSessionCookie && isProtectedPath(pathname) ? "/auth/login" : null;
}
