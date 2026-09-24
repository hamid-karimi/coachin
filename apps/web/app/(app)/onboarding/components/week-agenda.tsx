"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { useDeleteSchedule, useRoutine } from "../hooks/use-routine";
import { useTodayDow } from "../hooks/use-today-dow";
import { PlanSessionCard } from "./plan-session-card";
import { PlanSessionSheet } from "../../components/plan-session-sheet";
import { RoutineSessionCard } from "./routine-session-card";
import type { PlanItem } from "./types";

/** Guides instead of feeling broken: fixes "finish with an empty week". */
function EmptyWeek() {
  return (
    <div className='border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center'>
      <span className='bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full'>
        <CalendarDays className='size-5' aria-hidden />
      </span>
      <p className='text-foreground font-semibold'>Your week is empty</p>
      <p className='text-muted-foreground max-w-70 text-sm leading-relaxed'>
        Add at least one session to start earning XP. Most people start with 3 days.
      </p>
    </div>
  );
}

/** Two-swatch key, shown only when an AI plan sits beside the routine. */
function Legend() {
  return (
    <div className='text-muted-foreground mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs'>
      <span className='inline-flex items-center gap-1.5'>
        <span className='bg-brand-tint border-brand/25 size-3 rounded-sm border' />
        Your recurring routine
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <span className='bg-secondary border-border size-3 rounded-sm border' />
        AI plan · tap to view (edit in Training)
      </span>
    </div>
  );
}

/**
 * Day-by-day agenda (same on every screen size): each day lists its fixed
 * sessions (removable) and AI plan sessions (open a detail sheet).
 */
export function WeekAgenda() {
  const { schedules, planItems } = useRoutine();
  const remove = useDeleteSchedule();
  const todayDow = useTodayDow();
  const [selected, setSelected] = useState<PlanItem | null>(null);

  if (schedules.length === 0 && planItems.length === 0) {
    return (
      <div className='mb-6'>
        <EmptyWeek />
      </div>
    );
  }

  return (
    <div className='mb-6'>
      {planItems.length > 0 && <Legend />}
      <div className='border-border divide-border flex flex-col divide-y rounded-xl border'>
        {WEEK_DAYS.map((day) => {
          const daySchedules = schedules.filter((s) => s.dayOfWeek === day.id);
          const dayPlan = planItems.filter((p) => p.dayOfWeek === day.id);
          const isToday = day.id === todayDow;
          return (
            <div
              key={day.id}
              className={cn(
                "flex flex-col gap-2.5 p-3 sm:flex-row sm:gap-4 sm:p-4",
                isToday && "border-l-brand border-l-2",
              )}>
              <div className='flex items-center gap-2 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5 sm:pt-1'>
                <span className='text-foreground text-sm font-bold sm:text-base'>{day.short}</span>
                <span className='text-muted-foreground hidden text-xs sm:block'>{day.name}</span>
                {isToday && (
                  <span className='bg-brand text-brand-foreground rounded-full px-1.5 text-[10px] font-bold'>today</span>
                )}
              </div>
              {/* min-w-0 lets long AI titles truncate instead of overflowing. */}
              <div className='flex min-w-0 flex-1 flex-col gap-2'>
                {daySchedules.length === 0 && dayPlan.length === 0 ? (
                  <p className='text-muted-foreground/60 py-1 text-sm'>Rest day</p>
                ) : (
                  <>
                    {daySchedules.map((item) => (
                      <RoutineSessionCard
                        key={item.id}
                        name={item.sportName}
                        time={item.time}
                        dayName={day.name}
                        isDeleting={remove.isPending}
                        onDelete={() => remove.mutate({ params: { path: { id: item.id } } })}
                      />
                    ))}
                    {dayPlan.map((item) => (
                      <PlanSessionCard key={item.id} item={item} onSelect={setSelected} />
                    ))}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <PlanSessionSheet item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
