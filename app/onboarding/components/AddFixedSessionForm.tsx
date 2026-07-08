"use client";

import { useActionState, useReducer } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { useActionSuccess } from "@/components/hooks/use-action-success";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { addScheduleSessions } from "../actions";

interface AddFixedSessionFormProps {
  /** Selected sport id ("" = none) — sport is picked in the sheet's first step. */
  sportId: string;
  /** Days (0-6) that already have at least one session — shown as volt dots. */
  plannedDays?: number[];
  /** Called once after the server action saves (e.g. to close the sheet). */
  onSuccess?: () => void;
}

interface FormState {
  dayOfWeek: number | null;
  /** Bumped on save so the uncontrolled time/date inputs remount empty. */
  resetKey: number;
  dayError: string | null;
  sportError: string | null;
}

type FormAction =
  | { type: "toggle_day"; day: number }
  | { type: "reject"; dayError: string | null; sportError: string | null }
  | { type: "submitted" };

const INITIAL_STATE: FormState = {
  dayOfWeek: null,
  resetKey: 0,
  dayError: null,
  sportError: null,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "toggle_day": {
      const dayOfWeek = state.dayOfWeek === action.day ? null : action.day;
      // Picking a day answers the "pick a day" error; deselecting keeps it.
      return {
        ...state,
        dayOfWeek,
        dayError: dayOfWeek === null ? state.dayError : null,
      };
    }
    case "reject":
      return { ...state, dayError: action.dayError, sportError: action.sportError };
    case "submitted":
      return { ...INITIAL_STATE, resetKey: state.resetKey + 1 };
  }
}

/**
 * Adds an anchor: a fixed recurring session — day + optional time + optional
 * repeat-until for the sport picked upstream. The Add button is always enabled;
 * an invalid submit points at what's missing instead of a dead button.
 * `addScheduleSessions` revalidates the page after saving.
 */
export function AddFixedSessionForm({
  sportId,
  plannedDays = [],
  onSuccess,
}: AddFixedSessionFormProps) {
  const [state, formAction, isPending] = useActionState(
    addScheduleSessions,
    {},
  );
  useActionToast(state);
  useActionSuccess(state, onSuccess);

  const [form, dispatch] = useReducer(formReducer, INITIAL_STATE);

  // Derived, not cleared in an effect: the sport error only shows while the
  // sport is still missing, so picking one upstream hides it instantly.
  const visibleSportError = sportId === "" ? form.sportError : null;

  function handleSubmit(formData: FormData) {
    const sportError = sportId === "" ? "Pick a sport first" : null;
    const dayError = form.dayOfWeek === null ? "Pick at least one day" : null;
    if (sportError || dayError) {
      dispatch({ type: "reject", dayError, sportError });
      return;
    }
    formAction(formData);
    dispatch({ type: "submitted" });
  }

  return (
    <form action={handleSubmit} className='flex flex-col gap-5'>
      {/* hidden inputs the action reads by name */}
      <input
        type='hidden'
        name='day_of_week'
        value={form.dayOfWeek ?? ""}
        readOnly
      />
      <input type='hidden' name='sport_type_id' value={sportId} readOnly />

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
        <p aria-live='polite' className='text-destructive text-sm'>
          {form.dayError}
        </p>
      </div>

      <div className='flex flex-wrap items-end gap-3'>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='schedule-time'>Time (optional)</Label>
          <Input
            key={`time-${form.resetKey}`}
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
            key={`ends-${form.resetKey}`}
            id='schedule-ends'
            type='date'
            name='ends_on'
            className='w-44'
            disabled={isPending}
          />
        </div>

        <Button type='submit' variant='brand' disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>
      <p aria-live='polite' className='text-destructive text-sm'>
        {visibleSportError}
      </p>
    </form>
  );
}
