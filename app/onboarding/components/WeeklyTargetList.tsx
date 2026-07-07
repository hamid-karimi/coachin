"use client";

import { useActionState } from "react";
import { X } from "lucide-react";
import { SportIcon } from "@/components/design-system/sport-chip";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";
import type { QuotaProgress } from "@/lib/weekly-quotas";
import { deleteWeeklyQuota } from "../actions";

export interface WeeklyQuotaRow {
  id: string;
  sport_type_id: number;
  sessions_per_week: number;
  sport_types?: { name: string } | null;
  [key: string]: unknown;
}

interface WeeklyTargetListProps {
  quotas: WeeklyQuotaRow[];
  /** Current-week progress from `quotaProgress`, computed by the server page. */
  progress: QuotaProgress[];
}

/**
 * One row per weekly target: sport, target, live "n/m this week" badge (volt
 * once met), and remove. Renders nothing when there are no targets — the add
 * form above is the empty state. Progress is informational only: quotas never
 * touch streaks, hearts, or XP.
 */
export function WeeklyTargetList({ quotas, progress }: WeeklyTargetListProps) {
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteWeeklyQuota,
    {},
  );
  useActionToast(deleteState);

  if (quotas.length === 0) return null;

  const doneBySport = new Map(progress.map((p) => [p.sport_type_id, p.done]));

  function handleDelete(quotaId: string) {
    const formData = new FormData();
    formData.append("quotaId", quotaId);
    deleteAction(formData);
  }

  return (
    <section className='mb-6'>
      <p className='text-overline mb-2'>Weekly targets</p>
      <ul className='flex flex-col gap-2'>
        {quotas.map((quota) => {
          const name = quota.sport_types?.name;
          const done = doneBySport.get(quota.sport_type_id) ?? 0;
          const met = done >= quota.sessions_per_week;
          return (
            <li
              key={quota.id}
              className='border-border bg-card flex items-center gap-3 rounded-lg border p-3'>
              <SportIcon
                sport={sportFromName(name)}
                className='size-9 shrink-0 rounded-md'
              />
              <div className='min-w-0 flex-1'>
                <p className='text-foreground truncate text-sm font-semibold'>
                  {name ?? "Sport"}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {quota.sessions_per_week}× per week
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                  met
                    ? "bg-brand-tint text-brand-ink"
                    : "bg-secondary text-muted-foreground",
                )}>
                {done}/{quota.sessions_per_week} this week
              </span>
              <button
                type='button'
                onClick={() => handleDelete(quota.id)}
                disabled={isDeleting}
                aria-label={`Remove ${name ?? "sport"} weekly target`}
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
