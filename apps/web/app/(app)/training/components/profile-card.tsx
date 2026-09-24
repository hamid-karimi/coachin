import Link from "next/link";
import type { ComponentType } from "react";

interface ProfileCardProps {
  summary: string;
  complete: boolean;
  icon?: ComponentType<{ className?: string }>;
  /** Extra hint after "fill it in" when the profile is incomplete. */
  extraHint?: string;
}

/** "We'll personalize with your profile" + the body-profile summary. */
export function ProfileCard({ summary, complete, icon: Icon, extraHint }: ProfileCardProps) {
  return (
    <div className='bg-card border-border space-y-3 rounded-xl border p-4'>
      <p className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
        {Icon && <Icon className='text-brand size-4' aria-hidden />}
        We&apos;ll personalize with your profile
      </p>
      <p className='text-muted-foreground text-sm'>{summary}</p>
      {!complete && (
        <p className='text-flame-ink text-xs'>
          Your body profile is incomplete —{" "}
          <Link href='/profile' className='underline'>
            fill it in
          </Link>{" "}
          for a better plan (age, sex, height, weight).{extraHint ? ` ${extraHint}` : ""}
        </p>
      )}
    </div>
  );
}
