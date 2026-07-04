"use client";

import { CalendarDays, X } from "lucide-react";
import { SportIcon } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";

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

// 0=Sunday..6=Saturday — render Monday-first columns to match the week builder.
const DAYS = [
  { id: 1, short: "Mon", name: "Monday" },
  { id: 2, short: "Tue", name: "Tuesday" },
  { id: 3, short: "Wed", name: "Wednesday" },
  { id: 4, short: "Thu", name: "Thursday" },
  { id: 5, short: "Fri", name: "Friday" },
  { id: 6, short: "Sat", name: "Saturday" },
  { id: 0, short: "Sun", name: "Sunday" },
];

interface ScheduleGridProps {
  schedules: Schedule[];
  onDeleteClick: (
    scheduleId: string,
    formAction: (formData: FormData) => void,
  ) => void;
  deleteAction: (formData: FormData) => void;
  isDeleting?: boolean;
}

/** Guides instead of feeling broken: fixes "finish with an empty week". */
function EmptyWeek() {
  return (
    <div className='border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center'>
      <span className='bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full'>
        <CalendarDays className='size-5' aria-hidden />
      </span>
      <p className='text-foreground font-semibold'>Your week is empty</p>
      <p className='text-muted-foreground max-w-70 text-sm leading-relaxed'>
        Add at least one session to start earning XP. Most people start with 3
        days.
      </p>
    </div>
  );
}

export function ScheduleGrid({
  schedules,
  onDeleteClick,
  deleteAction,
  isDeleting = false,
}: ScheduleGridProps) {
  const itemsFor = (dayId: number) =>
    schedules?.filter((s: Schedule) => s.day_of_week === dayId) || [];

  if (!schedules || schedules.length === 0) {
    return (
      <div className='mb-6'>
        <EmptyWeek />
      </div>
    );
  }

  return (
    <div className='mb-6'>
      {/* Desktop: 7-column week grid that fills as you add */}
      <div className='hidden gap-2.5 md:grid md:grid-cols-7'>
        {DAYS.map((day) => {
          const dayItems = itemsFor(day.id);
          return (
            <div
              key={day.id}
              className='bg-card border-border flex min-h-32 flex-col gap-2 rounded-lg border p-3'>
              <h3 className='text-overline text-center'>{day.short}</h3>
              {dayItems.length === 0 ? (
                <p className='text-muted-foreground/60 flex flex-1 items-center justify-center text-xs'>
                  Rest
                </p>
              ) : (
                <div className='flex flex-col gap-2'>
                  {dayItems.map((item: Schedule) => (
                    <div
                      key={item.id}
                      className='bg-brand-tint border-brand/25 rounded-md border p-2'>
                      <div className='flex items-start justify-between gap-1'>
                        <p className='text-foreground min-w-0 truncate text-xs font-semibold'>
                          {item.sport_types?.name}
                        </p>
                        <button
                          type='button'
                          onClick={() => onDeleteClick(item.id, deleteAction)}
                          disabled={isDeleting}
                          aria-label={`Remove ${item.sport_types?.name ?? "session"} on ${day.name}`}
                          className='text-muted-foreground hover:text-foreground shrink-0 disabled:opacity-50'>
                          <X className='size-3.5' aria-hidden />
                        </button>
                      </div>
                      {item.time && (
                        <p className='text-muted-foreground mt-0.5 text-xs'>
                          {item.time.slice(0, 5)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: flat session list */}
      <div className='flex flex-col gap-2 md:hidden'>
        {DAYS.flatMap((day) =>
          itemsFor(day.id).map((item: Schedule) => (
            <div
              key={item.id}
              className='bg-card border-border flex items-center gap-3 rounded-lg border p-3'>
              <SportIcon
                sport={sportFromName(item.sport_types?.name)}
                className='size-9 shrink-0 rounded-md'
              />
              <div className='min-w-0 flex-1'>
                <p className='text-foreground truncate text-sm font-semibold'>
                  {day.short} · {item.sport_types?.name}
                </p>
                {item.time && (
                  <p className='text-muted-foreground text-xs'>
                    {item.time.slice(0, 5)}
                  </p>
                )}
              </div>
              <button
                type='button'
                onClick={() => onDeleteClick(item.id, deleteAction)}
                disabled={isDeleting}
                aria-label={`Remove ${item.sport_types?.name ?? "session"} on ${day.name}`}
                className='text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:opacity-50'>
                <X className='size-4' aria-hidden />
              </button>
            </div>
          )),
        )}
      </div>
    </div>
  );
}
