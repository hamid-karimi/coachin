/**
 * Fan out a single sport selection across one or more weekdays into the
 * `schedules` insert rows. Pure + framework-free so the multi-day logic is
 * unit-tested independently of the server action that calls it.
 */

export interface ScheduleInsertRow {
  user_id: string;
  sport_type_id: number;
  day_of_week: number;
  time: string | null;
  ends_on: string | null;
}

export interface BuildScheduleInsertsParams {
  userId: string;
  sportTypeId: number;
  /** Weekday ids (0=Sun..6=Sat); deduped, invalid entries dropped. */
  days: number[];
  /** HH:MM (optional); empty/whitespace normalizes to null. */
  time?: string | null;
  /** ISO date (optional); empty/whitespace normalizes to null. */
  endsOn?: string | null;
}

function normalize(value?: string | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * One insert row per valid, deduped day. Days outside 0-6 (or non-integers)
 * are dropped; an empty/all-invalid day list yields an empty array so the
 * caller can short-circuit instead of inserting nothing.
 */
export function buildScheduleInserts({
  userId,
  sportTypeId,
  days,
  time,
  endsOn,
}: BuildScheduleInsertsParams): ScheduleInsertRow[] {
  const normalizedTime = normalize(time);
  const normalizedEndsOn = normalize(endsOn);

  const validDays = [...new Set(days)].filter(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );

  return validDays.map((day) => ({
    user_id: userId,
    sport_type_id: sportTypeId,
    day_of_week: day,
    time: normalizedTime,
    ends_on: normalizedEndsOn,
  }));
}
