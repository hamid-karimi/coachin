export interface WeekDay {
  /** 0=Sunday..6=Saturday, matching the DB `day_of_week`. */
  id: number;
  short: string;
  name: string;
}

// Rendered Monday-first to match how people plan a training week, but each
// entry keeps its real 0-6 id so it maps straight onto `day_of_week`.
export const WEEK_DAYS: WeekDay[] = [
  { id: 1, short: "Mon", name: "Monday" },
  { id: 2, short: "Tue", name: "Tuesday" },
  { id: 3, short: "Wed", name: "Wednesday" },
  { id: 4, short: "Thu", name: "Thursday" },
  { id: 5, short: "Fri", name: "Friday" },
  { id: 6, short: "Sat", name: "Saturday" },
  { id: 0, short: "Sun", name: "Sunday" },
];

const BY_ID = new Map(WEEK_DAYS.map((day) => [day.id, day]));

/** Look up a day by its 0-6 id; undefined for anything out of range. */
export function weekDayOf(id: number): WeekDay | undefined {
  return BY_ID.get(id);
}
