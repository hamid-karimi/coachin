"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { addScheduleSessions } from "../actions";
import { SportPicker, type SportOption } from "./SportPicker";

interface AddFixedSessionFormProps {
  sports: SportOption[];
  /** Days (0-6) that already have at least one session — shown as volt dots. */
  plannedDays?: number[];
}

/**
 * Adds an anchor: a fixed recurring session — sport + day + optional time +
 * optional repeat-until. Owns its action state so the server page stays free
 * of client concerns; `addScheduleSessions` revalidates the page after saving.
 */
export function AddFixedSessionForm({
  sports,
  plannedDays = [],
}: AddFixedSessionFormProps) {
  const [state, formAction, isPending] = useActionState(
    addScheduleSessions,
    {},
  );
  useActionToast(state);

  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [sportId, setSportId] = useState<string>("");
  const [resetKey, setResetKey] = useState(0);

  const canSubmit = dayOfWeek !== null && sportId !== "";

  function handleSubmit(formData: FormData) {
    if (!canSubmit) return;
    formAction(formData);
    setDayOfWeek(null);
    setSportId("");
    setResetKey((k) => k + 1);
  }

  return (
    <form action={handleSubmit} className='flex flex-col gap-5'>
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
          {WEEK_DAYS.map((day) => {
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
        <SportPicker
          sports={sports}
          value={sportId}
          onChange={setSportId}
          disabled={isPending}
        />
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
