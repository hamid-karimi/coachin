import { cn } from "@/lib/utils";

/**
 * Monday-first ordering carrying real day_of_week ids (0=Sun..6=Sat),
 * same concept as `WEEK_DAYS` in lib/week-days.ts.
 */
const DAYS = [
  { id: 1, short: "Mon" },
  { id: 2, short: "Tue" },
  { id: 3, short: "Wed" },
  { id: 4, short: "Thu" },
  { id: 5, short: "Fri" },
  { id: 6, short: "Sat" },
  { id: 0, short: "Sun" },
];

interface AdherenceWeekStripProps {
  /** Distinct day_of_week values (0=Sun..6=Sat) the trainee has scheduled. */
  scheduledDays: number[];
  /** Distinct YYYY-MM-DD dates with a completed log this week. */
  loggedDates: string[];
  /** Monday of the current week, YYYY-MM-DD (local time). */
  weekStart: string;
}

/** Local-date YYYY-MM-DD formatting, same convention as app/dashboard/page.tsx. */
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 7-dot Monday-first strip of a trainee's week: completed logs, missed
 * scheduled days, today's pending session, upcoming sessions, and rest days.
 * Pure server-safe render — no client interactivity.
 */
export function AdherenceWeekStrip({
  scheduledDays,
  loggedDates,
  weekStart,
}: AdherenceWeekStripProps) {
  const [startYear, startMonth, startDay] = weekStart
    .split("-")
    .map((part) => Number(part));
  const todayString = formatLocalDate(new Date());

  return (
    <div className='flex gap-1.5'>
      {DAYS.map((day, index) => {
        const date = new Date(startYear, startMonth - 1, startDay + index);
        const dateString = formatLocalDate(date);

        const isLogged = loggedDates.includes(dateString);
        const isScheduled = scheduledDays.includes(day.id);
        const isToday = dateString === todayString;
        const isPast = dateString < todayString;

        let dotClass: string;
        let stateLabel: string;
        if (isLogged) {
          dotClass = "bg-success";
          stateLabel = "done";
        } else if (isScheduled && isPast) {
          dotClass = "bg-destructive/40";
          stateLabel = "missed";
        } else if (isScheduled && isToday) {
          dotClass = "bg-border ring-1 ring-brand";
          stateLabel = "planned today";
        } else if (isScheduled) {
          dotClass = "bg-border";
          stateLabel = "planned";
        } else {
          dotClass = "bg-border/40";
          stateLabel = "rest";
        }

        return (
          <span
            key={day.id}
            className='flex flex-col items-center gap-1'
            aria-label={`${day.short}: ${stateLabel}`}>
            <span
              className={cn("size-1.5 rounded-full", dotClass)}
              aria-hidden
            />
            <span
              className='text-[9px] leading-none text-muted-foreground'
              aria-hidden>
              {day.short[0]}
            </span>
          </span>
        );
      })}
    </div>
  );
}
