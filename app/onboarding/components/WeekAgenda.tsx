"use client";

import { useActionState, useState } from "react";
import { CalendarDays } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { deleteScheduleItem, type PlanWeekItem } from "../actions";
import { PlanSessionCard } from "./PlanSessionCard";
import { PlanSessionSheet } from "./PlanSessionSheet";
import { RoutineSessionCard } from "./RoutineSessionCard";

interface Schedule {
  id: string;
  user_id: string;
  sport_type_id: number;
  day_of_week: number;
  time: string | null;
  sport_types?: {
    name: string;
  };
  [key: string]: unknown;
}

interface WeekAgendaProps {
  schedules: Schedule[];
  /** Active AI plan's items for the current week, shown read-only per day. */
  planItems?: PlanWeekItem[];
}

/** Guides instead of feeling broken: fixes "finish with an empty week". */
function EmptyWeek() {
  return (
    <div className="border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center">
      <span className="bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full">
        <CalendarDays className="size-5" aria-hidden />
      </span>
      <p className="text-foreground font-semibold">Your week is empty</p>
      <p className="text-muted-foreground max-w-70 text-sm leading-relaxed">
        Add at least one session to start earning XP. Most people start with 3
        days.
      </p>
    </div>
  );
}

/** Two-swatch key shown only when an AI plan overlaps the manual routine. */
function Legend() {
  return (
    <div className="text-muted-foreground mb-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-brand-tint border-brand/25 size-3 rounded-sm border" />
        Your recurring routine
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="bg-secondary border-border size-3 rounded-sm border" />
        AI plan · tap to view (edit in Training)
      </span>
    </div>
  );
}

/**
 * One vertical day-by-day agenda used on every screen size: each day is a row
 * with a left gutter label and its full-width session cards, so titles never
 * truncate the way the old fixed 7-column grid forced. AI plan cards open a
 * detail sheet; manual routine cards keep their delete.
 */
export function WeekAgenda({ schedules, planItems = [] }: WeekAgendaProps) {
  const [selected, setSelected] = useState<PlanWeekItem | null>(null);

  // The agenda owns its delete flow so the server page stays free of client
  // concerns; `deleteScheduleItem` revalidates the page after removal.
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteScheduleItem,
    {},
  );
  useActionToast(deleteState);

  function handleDelete(scheduleId: string) {
    const formData = new FormData();
    formData.append("scheduleId", scheduleId);
    deleteAction(formData);
  }

  const hasPlan = planItems.length > 0;
  const todayDow = new Date().getDay();

  // With an active plan the week is never truly empty, so only fall back to the
  // "add your first session" prompt when there's nothing at all.
  if ((!schedules || schedules.length === 0) && !hasPlan) {
    return (
      <div className="mb-6">
        <EmptyWeek />
      </div>
    );
  }

  return (
    <div className="mb-6">
      {hasPlan && <Legend />}

      <div className="border-border divide-border flex flex-col divide-y rounded-xl border">
        {WEEK_DAYS.map((day) => {
          const dayItems = schedules.filter((s) => s.day_of_week === day.id);
          const dayPlan = planItems.filter((p) => p.day_of_week === day.id);
          const isToday = day.id === todayDow;
          const empty = dayItems.length === 0 && dayPlan.length === 0;

          return (
            <div
              key={day.id}
              className={cn(
                "flex flex-col gap-2.5 p-3 sm:flex-row sm:gap-4 sm:p-4",
                // Today: a quiet volt rail + the pill, instead of washing the
                // whole row in brand-tint (which fought with the cards).
                isToday && "border-l-2 border-l-brand",
              )}
            >
              <div className="flex items-center gap-2 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0.5 sm:pt-1">
                <span className="text-foreground text-sm font-bold sm:text-base">
                  {day.short}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:block">
                  {day.name}
                </span>
                {isToday && (
                  <span className="bg-brand text-brand-foreground rounded-full px-1.5 text-[10px] font-bold">
                    today
                  </span>
                )}
              </div>

              {/* min-w-0 lets long AI titles truncate instead of blowing the
                  card out past the container edge. */}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {empty ? (
                  <p className="text-muted-foreground/60 py-1 text-sm">
                    Rest day
                  </p>
                ) : (
                  <>
                    {dayItems.map((item) => (
                      <RoutineSessionCard
                        key={item.id}
                        name={item.sport_types?.name}
                        time={item.time}
                        dayName={day.name}
                        isDeleting={isDeleting}
                        onDelete={() => handleDelete(item.id)}
                      />
                    ))}
                    {dayPlan.map((item) => (
                      <PlanSessionCard
                        key={item.id}
                        item={item}
                        onSelect={setSelected}
                      />
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
