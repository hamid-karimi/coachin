/**
 * Date helpers used by server components. Living outside component render
 * keeps the react-hooks purity rule happy and the math in one place.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const YEAR_MS = 365.25 * DAY_MS;

/** Whole years since a YYYY-MM-DD date (age from birth_date). */
export function yearsSince(date: string | null | undefined): number | null {
  if (!date) return null;
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / YEAR_MS);
}

/** Whole weeks elapsed since a timestamp (0 during the first week). */
export function weeksSince(timestamp: string): number {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / WEEK_MS);
}

/** Days from today until a YYYY-MM-DD date, floored at 0. */
export function daysUntil(date: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / DAY_MS),
  );
}
