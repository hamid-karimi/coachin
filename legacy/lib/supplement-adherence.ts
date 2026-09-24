/**
 * Supplement taken-rate over a window of days. Pure + framework-free.
 * Informational only — taken-rates never award XP, streaks, or hearts
 * (FORMULAS.md §13); they just surface how consistently a supplement was
 * taken on the days it was actually due.
 *
 * Weekdays use the 0=Sun … 6=Sat convention (same as isSupplementDue).
 */

import { isSupplementDue, type SupplementSchedule } from "./supplement-schedule";

/** One day of the window: its local YYYY-MM-DD, weekday, and training flag. */
export type WindowDay = {
  /** YYYY-MM-DD (local). */
  ymd: string;
  /** 0=Sun … 6=Sat. */
  weekday: number;
  /**
   * Whether this day is a training day. Callers pass `true` for every day when
   * the trainee has no readable training structure, so `training_days`
   * supplements degrade to daily (same contract as isSupplementDue).
   */
  isTrainingDay: boolean;
};

export type SupplementTakenRate = {
  /** Due days in the window that have a log. */
  takenDueDays: number;
  /** Due days in the window on/after the supplement's created date. */
  totalDueDays: number;
};

/**
 * How many of a supplement's due days in the window were actually taken.
 *
 * A day counts toward `totalDueDays` only when it is on/after the supplement's
 * created date (`createdYmd`) AND the supplement is due that day. `takenDueDays`
 * counts the due days whose YMD is in `takenYmds`. YMD strings compare
 * lexicographically, so the created-date cutoff is a plain string compare.
 */
export function supplementTakenRate(
  schedule: SupplementSchedule,
  createdYmd: string,
  window: WindowDay[],
  takenYmds: ReadonlySet<string>,
): SupplementTakenRate {
  let takenDueDays = 0;
  let totalDueDays = 0;
  for (const day of window) {
    if (day.ymd < createdYmd) continue;
    if (
      !isSupplementDue(schedule, {
        weekday: day.weekday,
        isTrainingDay: day.isTrainingDay,
      })
    ) {
      continue;
    }
    totalDueDays += 1;
    if (takenYmds.has(day.ymd)) takenDueDays += 1;
  }
  return { takenDueDays, totalDueDays };
}
