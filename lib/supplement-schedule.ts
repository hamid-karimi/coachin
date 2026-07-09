/**
 * Supplement due-day rules for the daily stack. Pure + framework-free.
 * Informational only — dueness never awards XP, streaks, or hearts
 * (FORMULAS.md §13).
 *
 * Weekdays use the 0=Sun … 6=Sat convention (same as plan_items.day_of_week
 * and Date.getDay()).
 */

export type SupplementScheduleType = "daily" | "training_days" | "custom";

export type SupplementSchedule = {
  scheduleType: SupplementScheduleType;
  daysOfWeek: number[] | null;
};

export type DuenessContext = {
  /** Weekday to test, 0=Sun … 6=Sat. */
  weekday: number;
  /**
   * Whether `weekday` is a training day for the user. Callers MUST pass `true`
   * when the user has no active training plan, so `training_days` degrades to
   * daily rather than stranding the supplement.
   */
  isTrainingDay: boolean;
};

/** Weekday names indexed 0=Sun … 6=Sat, for schedule labels. */
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Is the supplement due on the given day?
 * - daily → always true
 * - training_days → true on training days (see DuenessContext.isTrainingDay:
 *   callers pass true when there is no active plan, so it degrades to daily)
 * - custom → true when the weekday is listed; an empty/null day list is
 *   treated as due every day so a misconfigured custom never strands a
 *   supplement off the checklist.
 */
export function isSupplementDue(
  schedule: SupplementSchedule,
  ctx: DuenessContext,
): boolean {
  const RULES: Record<SupplementScheduleType, () => boolean> = {
    daily: () => true,
    training_days: () => ctx.isTrainingDay,
    custom: () => {
      const days = schedule.daysOfWeek;
      if (!days || days.length === 0) return true;
      return days.includes(ctx.weekday);
    },
  };
  return (RULES[schedule.scheduleType] ?? RULES.daily)();
}

/**
 * Human label for a schedule: "Every day" / "Training days" / a custom
 * weekday list like "Sun · Tue · Thu" (ordered Sun→Sat). Custom with an
 * empty/null day list reads as "Every day".
 */
export function scheduleLabel(schedule: SupplementSchedule): string {
  if (schedule.scheduleType === "training_days") return "Training days";
  if (schedule.scheduleType === "custom") {
    const days = schedule.daysOfWeek;
    if (!days || days.length === 0) return "Every day";
    return WEEKDAY_NAMES.filter((_, index) => days.includes(index)).join(" · ");
  }
  return "Every day";
}
