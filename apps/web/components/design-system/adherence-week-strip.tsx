import { cn } from "@/lib/utils";

export type AdherenceState = "done" | "missed" | "planned_today" | "planned" | "rest";

export interface AdherenceDay {
  date: string;
  /** 0=Sun … 6=Sat */
  weekday: number;
  state: AdherenceState;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DOTS: Record<AdherenceState, { className: string; label: string }> = {
  done: { className: "bg-success", label: "done" },
  missed: { className: "bg-destructive/40", label: "missed" },
  planned_today: { className: "bg-border ring-brand ring-1", label: "planned today" },
  planned: { className: "bg-border", label: "planned" },
  rest: { className: "bg-border/40", label: "rest" },
};

/** A trainee's Monday-first week as 7 dots: done, missed, planned today, planned, rest. */
export function AdherenceWeekStrip({ days }: { days: AdherenceDay[] }) {
  return (
    <div className='flex gap-1.5'>
      {days.map((day) => {
        const dot = DOTS[day.state];
        return (
          <span
            key={day.date}
            title={`${DAY_SHORT[day.weekday]}: ${dot.label}`}
            aria-label={`${DAY_SHORT[day.weekday]}: ${dot.label}`}
            className={cn("size-2.5 rounded-full", dot.className)}
          />
        );
      })}
    </div>
  );
}
