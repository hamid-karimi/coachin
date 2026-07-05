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
  xp_multiplier?: number;
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
  /** Days (0-6) that already have at least one session — shown as volt dots. */
  plannedDays?: number[];
  isPending?: boolean;
}

export function AddScheduleForm({
  sports,
  onSubmit,
  plannedDays = [],
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
    <form action={handleSubmit} className='mb-6 flex flex-col gap-5'>
      {/* hidden inputs the action reads by name */}
      <input
        type='hidden'
        name='day_of_week'
        value={dayOfWeek ?? ""}
        readOnly
      />
      <input type='hidden' name='sport_type_id' value={sportId} readOnly />

      {/* Week strip: pick a day; the dot fills in as sessions are added. */}
      <div className='flex flex-col gap-2'>
        <Label>Day</Label>
        <div className='flex gap-1.5'>
          {DAYS.map((day) => {
            const active = dayOfWeek === day.id;
            const hasSessions = plannedDays.includes(day.id);
            return (
              <button
                key={day.id}
                type='button'
                onClick={() => setDayOfWeek(active ? null : day.id)}
                disabled={isPending}
                aria-pressed={active}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1.5 rounded-md border py-2.5 text-xs font-semibold transition-colors disabled:opacity-50",
                  active
                    ? "border-brand bg-brand text-brand-foreground font-bold"
                    : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40",
                )}>
                {day.short}
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    active
                      ? "bg-brand-foreground"
                      : hasSessions
                        ? "bg-brand"
                        : "bg-border",
                  )}
                  aria-hidden
                />
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
                onClick={() => setSportId(active ? "" : value)}
                disabled={isPending}
                aria-pressed={active}
                className={cn(
                  "rounded-full transition-all disabled:opacity-50",
                  active
                    ? "ring-brand ring-offset-background ring-2 ring-offset-2"
                    : "opacity-80 hover:opacity-100",
                )}>
                <SportChip
                  sport={sportFromName(sport.name)}
                  multiplier={sport.xp_multiplier}
                  selected={active}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='schedule-time'>Time (optional)</Label>
          <Input
            key={`time-${resetKey}`}
            id='schedule-time'
            type='time'
            name='time'
            className='w-36'
            disabled={isPending}
          />
        </div>

        <div className='flex flex-col gap-2'>
          <Label htmlFor='schedule-ends'>Repeat until (optional)</Label>
          <Input
            key={`ends-${resetKey}`}
            id='schedule-ends'
            type='date'
            name='ends_on'
            className='w-44'
            disabled={isPending}
          />
        </div>

        <Button
          type='submit'
          variant='brand'
          disabled={isPending || !canSubmit}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
