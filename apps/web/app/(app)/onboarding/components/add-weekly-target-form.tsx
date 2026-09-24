"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useSaveQuota } from "../hooks/use-routine";
import { clampSessions, DEFAULT_SESSIONS, MAX_SESSIONS, MIN_SESSIONS } from "../lib/commitments";

interface AddWeeklyTargetFormProps {
  /** Sport picked in the sheet's first step; null = none. */
  sportId: number | null;
  onSuccess?: () => void;
}

/**
 * Adds a weekly target (quota): the sport × N sessions per week, no fixed day.
 * Saving a sport that already has a target updates it instead of duplicating.
 */
export function AddWeeklyTargetForm({ sportId, onSuccess }: AddWeeklyTargetFormProps) {
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [sportError, setSportError] = useState<string | null>(null);
  const save = useSaveQuota(() => {
    setSessions(DEFAULT_SESSIONS);
    onSuccess?.();
  });
  const visibleSportError = sportId === null ? sportError : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (sportId === null) {
      setSportError("Pick a sport first");
      return;
    }
    setSportError(null);
    save.mutate({ params: { path: { sportTypeId: sportId } }, body: { sessionsPerWeek: sessions } });
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-5' noValidate>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-2'>
          <Label id='sessions-per-week-label'>Sessions per week</Label>
          <div role='group' aria-labelledby='sessions-per-week-label' className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => setSessions((n) => clampSessions(n - 1))}
              disabled={save.isPending || sessions <= MIN_SESSIONS}
              aria-label='Decrease sessions per week'>
              <Minus aria-hidden />
            </Button>
            <span aria-live='polite' className='text-foreground w-8 text-center text-sm font-bold'>
              {sessions}
            </span>
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => setSessions((n) => clampSessions(n + 1))}
              disabled={save.isPending || sessions >= MAX_SESSIONS}
              aria-label='Increase sessions per week'>
              <Plus aria-hidden />
            </Button>
          </div>
        </div>
        <Button type='submit' variant='brand' disabled={save.isPending}>
          {save.isPending ? "Adding…" : "Add"}
        </Button>
      </div>
      <p aria-live='polite' className='text-destructive text-sm'>
        {visibleSportError}
      </p>
      <p className='text-muted-foreground text-xs'>
        No fixed day — completed workouts of this sport count automatically. Adding a sport again updates its target.
      </p>
    </form>
  );
}
