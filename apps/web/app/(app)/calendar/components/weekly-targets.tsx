import { QuotaChip } from "@/components/design-system/quota-chip";
import type { CalendarWeek } from "../lib/calendar";

/** The viewed week's target progress; hidden without targets. Informational only (FORMULAS.md §11). */
export function WeeklyTargets({ quotas }: { quotas: CalendarWeek["quotas"] }) {
  if (quotas.length === 0) return null;
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      <span className='text-muted-foreground text-xs font-medium'>Weekly targets</span>
      {quotas.map((quota) => (
        <QuotaChip
          key={quota.sportTypeId}
          name={quota.sportName ?? "Sport"}
          done={quota.doneThisWeek}
          target={quota.sessionsPerWeek}
        />
      ))}
    </div>
  );
}
