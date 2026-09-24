"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { completeOnboarding } from "../actions";
import { useRedirect } from "../hooks";

interface CompleteOnboardingButtonProps {
  /** Number of distinct days with at least one fixed session. */
  plannedDayCount?: number;
  /** Estimated weekly XP from the current fixed sessions. */
  estimatedWeeklyXp?: number;
}

export function CompleteOnboardingButton({
  plannedDayCount = 0,
  estimatedWeeklyXp,
}: CompleteOnboardingButtonProps) {
  const [state, formAction, isPending] = useActionState(completeOnboarding, {});
  useActionToast(state);
  useRedirect({ redirectUrl: state.redirect });

  const empty = plannedDayCount === 0;

  return (
    <div className='border-border border-t pt-6'>
      <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          {empty ? (
            "Finish unlocks after your first session"
          ) : (
            <>
              {plannedDayCount} {plannedDayCount === 1 ? "day" : "days"} planned
              {estimatedWeeklyXp ? (
                <>
                  {" · "}
                  <span className='text-brand-ink font-semibold'>
                    est. ~{estimatedWeeklyXp.toLocaleString()} XP / week
                  </span>
                </>
              ) : null}
            </>
          )}
        </p>
        <form action={formAction}>
          <Button
            type='submit'
            variant='brand'
            size='lg'
            disabled={isPending || empty}>
            {isPending
              ? "Finishing…"
              : empty
                ? "Finish"
                : `Finish — ${plannedDayCount} ${plannedDayCount === 1 ? "day" : "days"} planned`}
          </Button>
        </form>
      </div>
      <p className='text-muted-foreground/70 mt-3 text-center text-xs sm:text-right'>
        You can come back and edit your commitments anytime
      </p>
    </div>
  );
}
