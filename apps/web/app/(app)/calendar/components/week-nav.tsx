import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { weekLabel, type CalendarWeek } from "../lib/calendar";

const NAV_LINK =
  "border-border text-foreground hover:bg-secondary inline-flex h-8 items-center gap-1 rounded-md border px-3 text-sm";

/** Prev / "Sep 21 – Sep 27 · this week" / Next. */
export function WeekNav({ week }: { week: CalendarWeek }) {
  return (
    <div className='flex items-center justify-between'>
      <Link href={`/calendar?week=${week.prevWeek}`} className={NAV_LINK}>
        <ChevronLeft className='size-4' aria-hidden />
        Prev
      </Link>
      <p className='text-foreground text-sm font-semibold'>
        {weekLabel(week)}
        {week.isCurrentWeek && <span className='text-brand-ink'> · this week</span>}
      </p>
      <Link href={`/calendar?week=${week.nextWeek}`} className={NAV_LINK}>
        Next
        <ChevronRight className='size-4' aria-hidden />
      </Link>
    </div>
  );
}
