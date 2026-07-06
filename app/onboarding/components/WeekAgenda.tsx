"use client";

import { useState } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import type { PlanWeekItem } from "../actions";
import { DaySportPicker, type SportType } from "./DaySportPicker";
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
  /** Sport types offered by the inline day-first picker. */
  sports: SportType[];
  /** Dispatches the multi-day `addScheduleSessions` server action. */
  addAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  isDeleting?: boolean;
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
        AI plan · tap to view (edit in Plan)
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
export function WeekAgenda({
  schedules,
  planItems = [],
  sports,
  addAction,
  deleteAction,
  isDeleting = false,
}: WeekAgendaProps) {
  const [selected, setSelected] = useState<PlanWeekItem | null>(null);
  const [openAddDay, setOpenAddDay] = useState<number | null>(null);
  // The routine session awaiting a delete confirmation.
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const hasPlan = planItems.length > 0;
  const todayDow = new Date().getDay();

  // ConfirmDialog runs onConfirm inside a transition, which is required for the
  // useActionState delete dispatch (calling it directly throws and wedges
  // isPending after the first delete).
  const confirmDelete = () => {
    if (!pendingDelete) return;
    const formData = new FormData();
    formData.append("scheduleId", pendingDelete.id);
    deleteAction(formData);
    setPendingDelete(null);
  };

  // With an active plan the week is never truly empty; otherwise nudge toward
  // the first session with a banner while keeping every day's "+ Add session"
  // reachable below.
  const isEmpty = (!schedules || schedules.length === 0) && !hasPlan;

  return (
    <div className="mb-6">
      {isEmpty && (
        <div className="mb-4">
          <EmptyWeek />
        </div>
      )}
      {hasPlan && <Legend />}

      <div className="border-border divide-border flex flex-col divide-y rounded-xl border">
        {WEEK_DAYS.map((day) => {
          const dayItems = schedules.filter((s) => s.day_of_week === day.id);
          const dayPlan = planItems.filter((p) => p.day_of_week === day.id);
          const isToday = day.id === todayDow;
          const empty = dayItems.length === 0 && dayPlan.length === 0;

          const isAddOpen = openAddDay === day.id;

          return (
            <div
              key={day.id}
              className={cn(
                "flex flex-col gap-2.5 p-3 sm:flex-row sm:gap-4 sm:p-4",
                isToday && "bg-brand-tint",
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

              <div className="flex flex-1 flex-col gap-2">
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
                        onDelete={() =>
                          setPendingDelete({
                            id: item.id,
                            name: item.sport_types?.name ?? "this session",
                          })
                        }
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

                {isAddOpen ? (
                  <DaySportPicker
                    entryDay={day.id}
                    sports={sports}
                    addAction={addAction}
                    onClose={() => setOpenAddDay(null)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenAddDay(day.id)}
                    className={cn(
                      "text-brand-ink hover:bg-brand-tint inline-flex w-fit items-center gap-1 rounded-md py-1 text-sm font-semibold outline-none",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    )}
                    aria-label={`Add session on ${day.name}`}
                  >
                    <Plus className="size-4" aria-hidden />
                    Add session
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PlanSessionSheet item={selected} onClose={() => setSelected(null)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remove this session?"
        description={
          pendingDelete
            ? `${pendingDelete.name} will be removed from your weekly routine.`
            : undefined
        }
        confirmLabel="Remove"
        pending={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
