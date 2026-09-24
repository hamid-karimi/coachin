import type { components } from "@/lib/api/schema";

export type ActivitySummary = components["schemas"]["ActivitySummaryBody"];

/** Legacy limit, checked by the API too. */
export const MAX_WATCH_FILES = 3;

/** "2026-09-20: 5.01km · 27.1min · 152 bpm" */
export function activityLine(activity: ActivitySummary): string {
  const hr = activity.avgHr ? ` · ${activity.avgHr} bpm` : "";
  return `${activity.date}: ${activity.distanceKm}km · ${activity.durationMin}min${hr}`;
}

/** The review step's line about uploaded runs. */
export function watchDataNote(count: number): string {
  if (count === 0) return "No watch data — the plan uses your answers and PBs.";
  return `${count} uploaded ${count === 1 ? "run" : "runs"} will inform your paces.`;
}

/** Parsed runs in the plan intake's shape (the prompt reads snake_case keys). */
export function intakeActivities(activities: ActivitySummary[]) {
  return activities.map((a) => ({
    date: a.date,
    distance_km: a.distanceKm,
    duration_min: a.durationMin,
    avg_pace_min_km: a.avgPaceMinKm,
    avg_hr: a.avgHr,
    source: a.source,
  }));
}

/** The multipart upload: every file under "activities". */
export function watchFilesForm(files: File[]): FormData {
  const form = new FormData();
  for (const file of files) form.append("activities", file);
  return form;
}
