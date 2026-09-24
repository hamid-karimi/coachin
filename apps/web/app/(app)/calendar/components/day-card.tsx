import { Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayLabel, isRestDay, type CalendarDay } from "../lib/calendar";
import { DayPlanItems } from "./day-plan-items";
import { RoutineSessionItem } from "./routine-session-item";

/** One day: routine sessions, plan sessions (with the collision nudge), or "Rest". */
export function DayCard({ day }: { day: CalendarDay }) {
  return (
    <div className={cn("border-border rounded-xl border p-3", day.isToday && "border-brand/40 bg-brand-tint/30")}>
      <div className='mb-2 flex items-center justify-between'>
        <p className='text-sm font-semibold'>
          {dayLabel(day.date)}
          {day.isToday && (
            <span className='bg-brand-tint text-brand-ink ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold'>
              Today
            </span>
          )}
        </p>
        {day.logged && (
          <span className='text-success inline-flex items-center gap-1 text-xs font-medium'>
            <Check className='size-3.5' aria-hidden />
            logged
          </span>
        )}
      </div>
      {isRestDay(day) ? (
        <p className='text-muted-foreground text-xs'>Rest</p>
      ) : (
        <div className='flex flex-col gap-1.5'>
          {day.hardCollision && (
            <p className='bg-flame-tint text-flame-ink inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-[11px] font-medium'>
              <TriangleAlert className='size-3' aria-hidden />2 intense workouts today — consider spacing them.
            </p>
          )}
          {day.routines.map((routine, index) => (
            <RoutineSessionItem key={index} routine={routine} isToday={day.isToday} />
          ))}
          <DayPlanItems items={day.planItems} />
        </div>
      )}
    </div>
  );
}
