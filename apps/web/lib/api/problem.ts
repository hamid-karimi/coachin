/** RFC 9457 problem details, as the API returns errors. */
type Problem = { detail?: string; title?: string };

function isProblem(value: unknown): value is Problem {
  return typeof value === "object" && value !== null && ("detail" in value || "title" in value);
}

/**
 * The user-facing message of a failed API call: the problem's detail (the
 * API keeps those safe to show), else its title, else the fallback.
 */
export function problemMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!isProblem(error)) return fallback;
  return error.detail?.trim() || error.title?.trim() || fallback;
}
