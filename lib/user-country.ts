/**
 * Locale resolution for nutrition prompts (nutrition-integrations phase 2).
 * Pure and framework-free: callers pass the profile value and the
 * x-vercel-ip-country header; the profile always wins.
 */

/** ISO-2 region code → English country name ("IR" → "Iran"); null on junk. */
export function countryNameFromCode(code: string | null): string | null {
  const trimmed = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return null;
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(trimmed);
    // Unknown codes either echo back ("XX" → "XX") or map to "Unknown Region".
    return name && name !== trimmed && name !== "Unknown Region" ? name : null;
  } catch {
    return null;
  }
}

/**
 * The country used in AI prompts: the user's profile entry when set,
 * otherwise the request's geo header decoded to a name, otherwise null
 * (prompts then keep their locale-neutral wording).
 */
export function resolveUserCountry(
  profileCountry: string | null | undefined,
  headerCode: string | null | undefined,
): string | null {
  const fromProfile = (profileCountry ?? "").trim().slice(0, 56);
  if (fromProfile) return fromProfile;
  return countryNameFromCode(headerCode ?? null);
}
