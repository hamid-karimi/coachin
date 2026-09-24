"use client";

import { CalendarHeart } from "lucide-react";
import { QuotaChip } from "@/components/design-system/quota-chip";
import { useToday } from "../hooks/use-today";
import { planCardSubtitle } from "../lib/today";
import { EntryCard } from "./entry-card";

/**
 * The training-plan card (or the plan generator pitch when there is none)
 * and the quiet weekly-target chips.
 */
export function PlanAndTargets() {
  const { activePlans, planItems, quotas } = useToday();
  return (
    <>
      {activePlans === 0 ? (
        <EntryCard
          href='/training'
          icon={CalendarHeart}
          title='Train for a marathon'
          subtitle='Get an AI week-by-week program built around your running'
        />
      ) : (
        <EntryCard
          href='/training'
          icon={CalendarHeart}
          title={activePlans > 1 ? "Training plans" : "Training plan"}
          subtitle={planCardSubtitle(activePlans, planItems.length)}
        />
      )}

      {quotas.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5 px-0.5'>
          <span className='text-muted-foreground text-xs font-medium'>This week</span>
          {quotas.map((quota) => (
            <QuotaChip
              key={quota.sportTypeId}
              name={quota.sportName ?? "Sport"}
              done={quota.doneThisWeek}
              target={quota.sessionsPerWeek}
            />
          ))}
        </div>
      )}
    </>
  );
}
