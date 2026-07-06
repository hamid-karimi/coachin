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

/** 1-based current plan week from the plan's creation timestamp, clamped. */
export function planWeekOf(createdAt: string, weeksTotal: number): number {
  return Math.min(Math.max(weeksSince(createdAt) + 1, 1), weeksTotal);
}

/**
 * Last fully-elapsed plan week (0 while still inside week 1), clamped to the
 * plan length — the week a check-in reviews.
 */
export function lastElapsedPlanWeek(
  createdAt: string,
  weeksTotal: number,
): number {
  return Math.min(Math.max(weeksSince(createdAt), 0), weeksTotal);
}

/** Days from today until a YYYY-MM-DD date, floored at 0. */
export function daysUntil(date: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / DAY_MS),
  );
}

/** YYYY-MM-DD in local time. */
export function toLocalYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Monday (local, midnight) of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (date.getDay() + 6) % 7; // Mon=0..Sun=6
  monday.setDate(monday.getDate() - offset);
  return monday;
}

/** Which plan week a calendar date falls in (1-based; may be out of range). */
export function planWeekForDate(createdAt: string, date: Date): number {
  const week1Monday = mondayOf(new Date(createdAt));
  const targetMonday = mondayOf(date);
  const diffWeeks = Math.round(
    (targetMonday.getTime() - week1Monday.getTime()) / WEEK_MS,
  );
  return diffWeeks + 1;
}

/**
 * Local calendar date of a plan item. Week 1 is the (Monday-anchored) week
 * containing the plan's creation date; days render Monday-first, but
 * `dayOfWeek` carries the real 0=Sun..6=Sat id.
 */
export function planItemDate(
  createdAt: string,
  week: number,
  dayOfWeek: number,
): Date {
  const created = new Date(createdAt);
  const week1Monday = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  );
  const mondayOffset = (created.getDay() + 6) % 7; // Mon=0..Sun=6
  week1Monday.setDate(week1Monday.getDate() - mondayOffset);

  const dayOffset = (dayOfWeek + 6) % 7; // Monday-first position in the week
  const date = new Date(week1Monday);
  date.setDate(week1Monday.getDate() + (week - 1) * 7 + dayOffset);
  return date;
}
