"use client";

import { X } from "lucide-react";
import { SportIcon } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { useDeleteQuota, useRoutine } from "../hooks/use-routine";

/**
 * One row per weekly target with its "n/m this week" badge (volt once met)
 * and remove. Renders nothing without targets — the add button above is the
 * empty state. Informational only: quotas never touch streaks, hearts, or XP.
 */
export function WeeklyTargetList() {
  const { quotas } = useRoutine();
  const remove = useDeleteQuota();
  if (quotas.length === 0) return null;

  return (
    <section className='mb-6'>
      <p className='text-overline mb-2'>Weekly targets</p>
      <ul className='flex flex-col gap-2'>
        {quotas.map((quota) => {
          const name = quota.sportName ?? "Sport";
          const met = quota.doneThisWeek >= quota.sessionsPerWeek;
          return (
            <li key={quota.id} className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'>
              <SportIcon sport={sportFromName(quota.sportName)} className='size-9 shrink-0 rounded-md' />
              <div className='min-w-0 flex-1'>
                <p className='text-foreground truncate text-sm font-semibold'>{name}</p>
                <p className='text-muted-foreground text-xs'>{quota.sessionsPerWeek}× per week</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                  met ? "bg-brand-tint text-brand-ink" : "bg-secondary text-muted-foreground",
                )}>
                {quota.doneThisWeek}/{quota.sessionsPerWeek} this week
              </span>
              <button
                type='button'
                onClick={() => remove.mutate({ params: { path: { sportTypeId: quota.sportTypeId } } })}
                disabled={remove.isPending}
                aria-label={`Remove ${name} weekly target`}
                className='text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:opacity-50'>
                <X className='size-4' aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
