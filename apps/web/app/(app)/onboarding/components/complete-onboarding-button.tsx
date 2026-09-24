"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRoutine } from "../hooks/use-routine";
import { daysPlannedLabel, plannedDays } from "../lib/commitments";

/** Finish: unlocked once the week has a fixed session; goes to Today. */
export function CompleteOnboardingButton() {
  const { schedules, estimatedWeeklyXp } = useRoutine();
  const router = useRouter();
  const dayCount = plannedDays(schedules).length;
  const empty = dayCount === 0;

  function finish() {
    toast.success("Onboarding completed successfully.");
    router.push("/dashboard");
  }

  return (
    <div className='border-border border-t pt-6'>
      <div className='flex flex-col items-center gap-3 sm:flex-row sm:justify-between'>
        <p className='text-muted-foreground text-sm'>
          {empty ? (
            "Finish unlocks after your first session"
          ) : (
            <>
              {daysPlannedLabel(dayCount)}
              {estimatedWeeklyXp > 0 && (
                <>
                  {" · "}
                  <span className='text-brand-ink font-semibold'>
                    est. ~{estimatedWeeklyXp.toLocaleString()} XP / week
                  </span>
                </>
              )}
            </>
          )}
        </p>
        <Button type='button' variant='brand' size='lg' disabled={empty} onClick={finish}>
          {empty ? "Finish" : `Finish — ${daysPlannedLabel(dayCount)}`}
        </Button>
      </div>
      <p className='text-muted-foreground/70 mt-3 text-center text-xs sm:text-right'>
        You can come back and edit your commitments anytime
      </p>
    </div>
  );
}
