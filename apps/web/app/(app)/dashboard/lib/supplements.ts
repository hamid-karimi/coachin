import type { components } from "@/lib/api/schema";
import { WEEK_DAYS } from "@/lib/week-days";

export type Supplement = components["schemas"]["SupplementBody"];
export type ScheduleType = Supplement["scheduleType"];

export interface ScheduleValue {
  scheduleType: ScheduleType;
  daysOfWeek: number[];
}

export const SCHEDULE_OPTIONS: { value: ScheduleType; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "training_days", label: "Training days" },
  { value: "custom", label: "Custom" },
];

/** Sunday-first chips, matching how schedule labels read ("Sun · Tue"). */
export const SCHEDULE_WEEKDAYS = [...WEEK_DAYS].sort((a, b) => a.id - b.id);

export const DEFAULT_SCHEDULE: ScheduleValue = { scheduleType: "daily", daysOfWeek: [] };

/** Adds or removes a weekday, keeping the list sorted. */
export function toggleDay(days: number[], day: number): number[] {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort((a, b) => a - b);
}

/** The request body for a schedule: days only matter for custom. */
export function scheduleBody(value: ScheduleValue): ScheduleValue {
  return value.scheduleType === "custom" ? value : { scheduleType: value.scheduleType, daysOfWeek: [] };
}

/** Today's checklist and its "x of y taken" tally. */
export function dueChecklist(stack: Supplement[]): { due: Supplement[]; taken: number } {
  const due = stack.filter((s) => s.dueToday);
  return { due, taken: due.filter((s) => s.takenToday).length };
}
