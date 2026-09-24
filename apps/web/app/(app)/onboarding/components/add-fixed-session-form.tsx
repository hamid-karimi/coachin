"use client";

import { useReducer } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { useAddSchedules } from "../hooks/use-routine";
import { fixedSessionErrors, fixedSessionReducer, INITIAL_FIXED_SESSION } from "../lib/commitments";

interface AddFixedSessionFormProps {
  /** Sport picked in the sheet's first step; null = none. */
  sportId: number | null;
  /** Days (0-6) that already have at least one session — shown as volt dots. */
  plannedDays: number[];
  /** Called after the save (e.g. to close the sheet). */
  onSuccess?: () => void;
}

/**
 * Adds an anchor: a fixed recurring session — day + optional time + optional
 * repeat-until. Add is always enabled; an invalid submit points at what's
 * missing instead of a dead button.
 */
export function AddFixedSessionForm({ sportId, plannedDays, onSuccess }: AddFixedSessionFormProps) {
  const [form, dispatch] = useReducer(fixedSessionReducer, INITIAL_FIXED_SESSION);
  const add = useAddSchedules(() => {
    dispatch({ type: "reset" });
    onSuccess?.();
  });

  // Derived: the sport error only shows while the sport is still missing.
  const visibleSportError = sportId === null ? form.sportError : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = fixedSessionErrors(sportId, form.dayOfWeek);
    if (errors || sportId === null || form.dayOfWeek === null) {
      dispatch({ type: "reject", dayError: errors?.dayError ?? null, sportError: errors?.sportError ?? null });
      return;
    }
    add.mutate({ body: { sportTypeId: sportId, days: [form.dayOfWeek], time: form.time, endsOn: form.endsOn } });
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-5' noValidate>
      {/* Week strip: pick a day; the dot fills in as sessions are added. */}
      <div className='flex flex-col gap-2'>
        <Label>Day</Label>
        <div className='flex gap-1.5'>
          {WEEK_DAYS.map((day) => {
            const active = form.dayOfWeek === day.id;
            const hasSessions = plannedDays.includes(day.id);
            return (
              <button
                key={day.id}
                type='button'
                onClick={() => dispatch({ type: "toggle_day", day: day.id })}
                disabled={add.isPending}
                aria-pressed={active}
                aria-label={day.name}
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
                    active ? "bg-brand-foreground" : hasSessions ? "bg-brand" : "bg-border",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
        <p aria-live='polite' className='text-destructive text-sm'>
          {form.dayError}
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='schedule-time'>Time (optional)</Label>
          <Input
            id='schedule-time'
            type='time'
            value={form.time}
            onChange={(e) => dispatch({ type: "set_time", value: e.target.value })}
            className='w-36'
            disabled={add.isPending}
          />
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='schedule-ends'>Repeat until (optional)</Label>
          <Input
            id='schedule-ends'
            type='date'
            value={form.endsOn}
            onChange={(e) => dispatch({ type: "set_ends_on", value: e.target.value })}
            className='w-44'
            disabled={add.isPending}
          />
        </div>
        <Button type='submit' variant='brand' disabled={add.isPending}>
          {add.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
      <p aria-live='polite' className='text-destructive text-sm'>
        {visibleSportError}
      </p>
    </form>
  );
}
