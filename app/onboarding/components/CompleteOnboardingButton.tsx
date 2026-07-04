import { Button } from "@/components/ui/button";

interface CompleteOnboardingButtonProps {
  onSubmit: (formData: FormData) => void;
  /** Number of distinct days with at least one session. */
  plannedDayCount?: number;
  /** Estimated weekly XP from the current plan. */
  estimatedWeeklyXp?: number;
  isPending?: boolean;
}

export function CompleteOnboardingButton({
  onSubmit,
  plannedDayCount = 0,
  estimatedWeeklyXp,
  isPending = false,
}: CompleteOnboardingButtonProps) {
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
        <form action={onSubmit}>
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
        You can change this anytime in Plan
      </p>
    </div>
  );
}
