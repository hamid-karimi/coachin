"use client";

import { useActionState, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { useActionSuccess } from "@/components/hooks/use-action-success";
import { addWeeklyQuota } from "../actions";

// Bounds mirror the `weekly_quotas.sessions_per_week` CHECK (1..14); most
// people target 1–7, so the stepper starts low and steps by one.
const MIN_SESSIONS = 1;
const MAX_SESSIONS = 14;
const DEFAULT_SESSIONS = 2;

interface AddWeeklyTargetFormProps {
  /** Selected sport id ("" = none) — sport is picked in the sheet's first step. */
  sportId: string;
  /** Called once after the server action saves (e.g. to close the sheet). */
  onSuccess?: () => void;
}

/**
 * Adds a weekly target (quota): the sport picked upstream × N sessions per
 * week with no fixed day. The Add button is always enabled; submitting without
 * a sport points at the gap instead of a dead button. Posts to
 * `addWeeklyQuota`, which upserts on the user+sport pair — so re-adding a
 * sport updates its target instead of duplicating it.
 */
export function AddWeeklyTargetForm({
  sportId,
  onSuccess,
}: AddWeeklyTargetFormProps) {
  const [state, formAction, isPending] = useActionState(addWeeklyQuota, {});
  useActionToast(state);
  useActionSuccess(state, onSuccess);

  const [sessions, setSessions] = useState(DEFAULT_SESSIONS);
  const [sportError, setSportError] = useState<string | null>(null);
  // Derived, not cleared in an effect: the error only shows while the sport is
  // still missing, so picking one upstream hides it instantly.
  const visibleSportError = sportId === "" ? sportError : null;

  function handleSubmit(formData: FormData) {
    if (sportId === "") {
      setSportError("Pick a sport first");
      return;
    }
    setSportError(null);
    formAction(formData);
    setSessions(DEFAULT_SESSIONS);
  }

  return (
    <form action={handleSubmit} className='flex flex-col gap-5'>
      {/* hidden inputs the action reads by name */}
      <input type='hidden' name='sport_type_id' value={sportId} readOnly />
      <input type='hidden' name='sessions_per_week' value={sessions} readOnly />

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

        <Button type='submit' variant='brand' disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>
      <p aria-live='polite' className='text-destructive text-sm'>
        {visibleSportError}
      </p>

      <p className='text-muted-foreground text-xs'>
        No fixed day — completed workouts of this sport count automatically.
        Adding a sport again updates its target.
      </p>
    </form>
  );
}
