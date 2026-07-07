"use client";

import { useActionState, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { addWeeklyQuota } from "../actions";
import { SportPicker, type SportOption } from "./SportPicker";

// Bounds mirror the `weekly_quotas.sessions_per_week` CHECK (1..14); most
// people target 1–7, so the stepper starts low and steps by one.
const MIN_SESSIONS = 1;
const MAX_SESSIONS = 14;
const DEFAULT_SESSIONS = 2;

interface AddWeeklyTargetFormProps {
  sports: SportOption[];
}

/**
 * Adds a weekly target (quota): sport × N sessions per week with no fixed
 * day. Posts to `addWeeklyQuota`, which upserts on the user+sport pair — so
 * re-adding a sport updates its target instead of duplicating it.
 */
export function AddWeeklyTargetForm({ sports }: AddWeeklyTargetFormProps) {
  const [state, formAction, isPending] = useActionState(addWeeklyQuota, {});
  useActionToast(state);

  const [sportId, setSportId] = useState<string>("");
  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);

  const canSubmit = sportId !== "";

  function handleSubmit(formData: FormData) {
    if (!canSubmit) return;
    formAction(formData);
    setSportId("");
    setSessions(DEFAULT_SESSIONS);
  }

  return (
    <form action={handleSubmit} className='flex flex-col gap-5'>
      {/* hidden inputs the action reads by name */}
      <input type='hidden' name='sport_type_id' value={sportId} readOnly />
      <input type='hidden' name='sessions_per_week' value={sessions} readOnly />

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
          <Label id='sessions-per-week-label'>Sessions per week</Label>
          <div
            role='group'
            aria-labelledby='sessions-per-week-label'
            className='flex items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => setSessions((n) => Math.max(MIN_SESSIONS, n - 1))}
              disabled={isPending || sessions <= MIN_SESSIONS}
              aria-label='Decrease sessions per week'>
              <Minus aria-hidden />
            </Button>
            <span
              aria-live='polite'
              className='text-foreground w-8 text-center text-sm font-bold'>
              {sessions}
            </span>
            <Button
              type='button'
              variant='outline'
              size='icon'
              onClick={() => setSessions((n) => Math.min(MAX_SESSIONS, n + 1))}
              disabled={isPending || sessions >= MAX_SESSIONS}
              aria-label='Increase sessions per week'>
              <Plus aria-hidden />
            </Button>
          </div>
        </div>

        <Button
          type='submit'
          variant='brand'
          disabled={isPending || !canSubmit}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>

      <p className='text-muted-foreground text-xs'>
        No fixed day — completed workouts of this sport count automatically.
        Adding a sport again updates its target.
      </p>
    </form>
  );
}
