"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SportChip } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";

interface SportType {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

// day_of_week semantics are 0=Sunday..6=Saturday (matches the DB / actions).
// UI shows a Monday-first row, but each chip carries its real 0-6 id.
const DAYS = [
  { id: 1, short: "Mon" },
  { id: 2, short: "Tue" },
  { id: 3, short: "Wed" },
  { id: 4, short: "Thu" },
  { id: 5, short: "Fri" },
  { id: 6, short: "Sat" },
  { id: 0, short: "Sun" },
];

interface AddScheduleFormProps {
  sports: SportType[];
  onSubmit: (formData: FormData) => void;
  isPending?: boolean;
}

export function AddScheduleForm({
  sports,
  onSubmit,
  isPending = false,
}: AddScheduleFormProps) {
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [sportId, setSportId] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);

  const canSubmit = dayOfWeek !== null && sportId !== "";

  function handleSubmit(formData: FormData) {
    if (!canSubmit) return;
    onSubmit(formData);
    setDayOfWeek(null);
    setSportId("");
    setResetKey((k) => k + 1);
  }

  return (
    <div className='mb-8 rounded-xl border border-border bg-secondary/40 p-5 md:p-6'>
      <h3 className='mb-4 font-semibold text-card-foreground'>
        Add a session
      </h3>

      <form action={handleSubmit} className='flex flex-col gap-5'>
        {/* hidden inputs the action reads by name */}
        <input
          type='hidden'
          name='day_of_week'
          value={dayOfWeek ?? ""}
          readOnly
        />
        <input type='hidden' name='sport_type_id' value={sportId} readOnly />

        <div className='flex flex-col gap-2'>
          <Label>Day of week</Label>
          <div className='flex flex-wrap gap-2'>
            {DAYS.map((day) => {
              const active = dayOfWeek === day.id;
              return (
                <button
                  key={day.id}
                  type='button'
                  onClick={() => setDayOfWeek(day.id)}
                  disabled={isPending}
                  aria-pressed={active}
                  className={cn(
                    "h-9 min-w-12 rounded-full px-3 text-sm font-medium transition-colors disabled:opacity-50",
                    active
                      ? "bg-brand text-brand-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                  )}>
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <Label>Sport</Label>
          <div className='flex flex-wrap gap-2'>
            {sports?.map((sport: SportType) => {
              const value = String(sport.id);
              const active = sportId === value;
              return (
                <button
                  key={sport.id}
                  type='button'
                  onClick={() => setSportId(value)}
                  disabled={isPending}
                  aria-pressed={active}
                  className={cn(
                    "rounded-full transition-all disabled:opacity-50",
                    active
                      ? "ring-2 ring-brand ring-offset-1 ring-offset-card"
                      : "opacity-80 hover:opacity-100",
                  )}>
                  <SportChip sport={sportFromName(sport.name)} />
                </button>
              );
            })}
          </div>
        </div>

        <div className='flex flex-wrap items-end gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='schedule-time'>Time (optional)</Label>
            <Input
              key={resetKey}
              id='schedule-time'
              type='time'
              name='time'
              className='w-36'
              disabled={isPending}
            />
          </div>

          <Button
            type='submit'
            variant='brand'
            disabled={isPending || !canSubmit}>
            {isPending ? "Adding..." : "Add session"}
          </Button>
        </div>
      </form>
    </div>
  );
}
