/**
 * Watch-file import rules (nutrition-integrations phase 3, FORMULAS.md §14):
 * imported activities become completed logs with the same XP as a routine
 * log, but only within a recent window and never twice for one sport×date.
 * Pure and framework-free — the profile action does the I/O.
 */
import type { ActivitySummary } from "@/lib/activity-parse";

export const IMPORT_WINDOW_DAYS = 14;
export const MAX_IMPORT_ACTIVITIES = 20;

export type ImportSplit = {
  /** Deduped, in-window activities to insert (one per date). */
  importable: ActivitySummary[];
  /** Dates skipped because a completed log of the sport already exists. */
  duplicates: string[];
  /** Dates skipped as older than the window or in the future. */
  outOfWindow: string[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a client-posted activities payload; invalid entries are dropped. */
export function sanitizeActivities(raw: unknown): ActivitySummary[] {
  if (!Array.isArray(raw)) return [];
  const activities: ActivitySummary[] = [];
  for (const entry of raw.slice(0, MAX_IMPORT_ACTIVITIES)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const date = String(item.date ?? "");
    const distanceKm = Number(item.distance_km);
    const durationMin = Number(item.duration_min);
    if (!DATE_PATTERN.test(date)) continue;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0 || distanceKm > 500)
      continue;
    if (!Number.isFinite(durationMin) || durationMin <= 0) continue;
    const avgHr = Number(item.avg_hr);
    activities.push({
      date,
      distance_km: Math.round(distanceKm * 100) / 100,
      duration_min: Math.round(durationMin * 10) / 10,
      avg_pace_min_km: null,
      avg_hr: Number.isFinite(avgHr) && avgHr > 0 ? Math.round(avgHr) : null,
      source: item.source === "fit" ? "fit" : "gpx",
    });
  }
  return activities;
}

/**
 * Split activities into importable / skipped. `existingLogDates` are the
 * dates that already have a completed log of the sport; `todayYmd` anchors
 * the window (dates newer than today or older than IMPORT_WINDOW_DAYS are
 * out). Two files on the same date import once (first wins).
 */
export function splitImportableActivities(
  activities: ActivitySummary[],
  existingLogDates: Iterable<string>,
  todayYmd: string,
): ImportSplit {
  const taken = new Set(existingLogDates);
  const windowStart = shiftYmd(todayYmd, -(IMPORT_WINDOW_DAYS - 1));

  const split: ImportSplit = { importable: [], duplicates: [], outOfWindow: [] };
  for (const activity of activities) {
    if (activity.date < windowStart || activity.date > todayYmd) {
      split.outOfWindow.push(activity.date);
    } else if (taken.has(activity.date)) {
      split.duplicates.push(activity.date);
    } else {
      taken.add(activity.date);
      split.importable.push(activity);
    }
  }
  return split;
}

function shiftYmd(ymd: string, days: number): string {
  const date = new Date(`${ymd}T00:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
