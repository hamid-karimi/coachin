"use client";

import { useProfileOverview } from "../hooks/use-profile";
import { xpDateLabel } from "../lib/profile";

/** The 5 newest XP ledger rows. */
export function RecentXp() {
  const { recentXp } = useProfileOverview();
  if (recentXp.length === 0) {
    return (
      <div className='border-border rounded-xl border border-dashed p-5 text-center'>
        <p className='text-muted-foreground text-sm'>No XP yet — log your first workout and it shows up here.</p>
      </div>
    );
  }
  return (
    <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
      {recentXp.map((entry) => (
        <div key={entry.id} className='flex items-center justify-between gap-3 py-3'>
          <div className='min-w-0'>
            <p className='text-foreground truncate text-sm font-medium first-letter:uppercase'>{entry.label}</p>
            <p className='text-muted-foreground text-xs'>{xpDateLabel(entry.createdAt)}</p>
          </div>
          <span className='text-brand-ink text-stat shrink-0 text-sm'>
            {entry.amount > 0 ? "+" : ""}
            {entry.amount}
          </span>
        </div>
      ))}
    </div>
  );
}
