"use client";

import { X } from "lucide-react";
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

function SessionItem({
  item,
  onRemove,
  isDeleting,
}: {
  item: Schedule;
  onRemove: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className='flex items-center gap-2 rounded-lg border border-border bg-card p-2'>
      <SportIcon
        sport={sportFromName(item.sport_types?.name)}
        className='size-8 shrink-0'
      />
      <div className='min-w-0 flex-1'>
        <p className='truncate text-xs font-medium text-card-foreground'>
          {item.sport_types?.name}
        </p>
        {item.time && (
          <p className='text-xs text-muted-foreground'>
            {item.time.slice(0, 5)}
          </p>
        )}
      </div>
      <button
        type='button'
        onClick={onRemove}
        disabled={isDeleting}
        aria-label='Remove session'
        className='inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-card-foreground disabled:opacity-50'>
        <X className='size-3.5' />
      </button>
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

  return (
    <div className='mb-8'>
      {/* Desktop: 7-column week grid */}
      <div className='hidden gap-3 md:grid md:grid-cols-7'>
        {DAYS.map((day) => {
          const dayItems = itemsFor(day.id);
          return (
            <div key={day.id} className='flex flex-col gap-2'>
              <h3 className='text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                {day.short}
              </h3>
              {dayItems.length === 0 ? (
                <p className='rounded-lg border border-dashed border-border py-3 text-center text-xs text-muted-foreground'>
                  Rest
                </p>
              ) : (
                <div className='flex flex-col gap-2'>
                  {dayItems.map((item: Schedule) => (
                    <SessionItem
                      key={item.id}
                      item={item}
                      isDeleting={isDeleting}
                      onRemove={() => onDeleteClick(item.id, deleteAction)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: grouped list */}
      <div className='flex flex-col gap-4 md:hidden'>
        {DAYS.map((day) => {
          const dayItems = itemsFor(day.id);
          return (
            <div key={day.id}>
              <h3 className='mb-2 text-sm font-semibold text-card-foreground'>
                {day.name}
              </h3>
              {dayItems.length === 0 ? (
                <p className='text-sm text-muted-foreground'>Rest</p>
              ) : (
                <div className='flex flex-col gap-2'>
                  {dayItems.map((item: Schedule) => (
                    <SessionItem
                      key={item.id}
                      item={item}
                      isDeleting={isDeleting}
                      onRemove={() => onDeleteClick(item.id, deleteAction)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
