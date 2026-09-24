import type { components } from "@/lib/api/schema";

export type CalendarWeek = components["schemas"]["CalendarBody"];
export type CalendarDay = components["schemas"]["CalendarDayBody"];
export type CalendarRoutine = components["schemas"]["CalendarRoutineBody"];

/** Request options for GET /calendar; shared by the server prefetch and the client so the query keys match. */
export function calendarQuery(week?: string | null) {
  return { params: { query: week ? { week } : {} } };
}

const shortDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** "Sep 21 – Sep 27" */
export function weekLabel(week: Pick<CalendarWeek, "weekStart" | "weekEnd">): string {
  return `${shortDate(week.weekStart)} – ${shortDate(week.weekEnd)}`;
}

/** "Thursday, Sep 24" */
export function dayLabel(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/** "Running · 07:00", "Workout" without a sport name. */
export function routineLabel(routine: Pick<CalendarRoutine, "sportName" | "time">): string {
  const name = routine.sportName ?? "Workout";
  return routine.time ? `${name} · ${routine.time}` : name;
}

/** A day with neither routine nor plan sessions is a rest day. */
export function isRestDay(day: Pick<CalendarDay, "routines" | "planItems">): boolean {
  return day.routines.length === 0 && day.planItems.length === 0;
}
