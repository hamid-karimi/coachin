"use client";

import { Flame } from "lucide-react";
import { TierBadge } from "@/components/design-system/tier-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToday } from "@/app/(app)/dashboard/hooks/use-today";
import { initials, levelPercent, plural } from "@/app/(app)/dashboard/lib/today";
import { useProfileOverview } from "../hooks/use-profile";
import { joinedLabel } from "../lib/profile";

/** Avatar in a level-progress ring, name, email · join date, level / tier / streak chips. */
export function ProfileIdentity({ name, email }: { name: string; email: string }) {
  const { stats } = useToday();
  const { joinedAt, avatarUrl } = useProfileOverview();
  const pct = levelPercent(stats.currentXp, stats.nextLevelXp);
  return (
    <div className='flex min-w-0 flex-1 items-center gap-4 md:gap-5'>
      <div
        className='grid size-19 shrink-0 place-items-center rounded-full md:size-22'
        style={{ background: `conic-gradient(var(--brand) 0 ${pct}%, var(--border) ${pct}% 100%)` }}
        aria-label={`Level ${stats.level}, ${pct}% to next level`}>
        <Avatar className='border-background size-16 border-3 md:size-19'>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
          <AvatarFallback className='text-lg font-bold md:text-xl'>{initials(name)}</AvatarFallback>
        </Avatar>
      </div>
      <div className='min-w-0 flex-1'>
        <h1 className='text-foreground font-display truncate text-[22px] font-bold tracking-tight md:text-[28px]'>
          {name}
        </h1>
        <p className='text-muted-foreground truncate text-sm'>
          {email} · {joinedLabel(joinedAt)}
        </p>
        <div className='mt-2 flex flex-wrap items-center gap-1.5'>
          <span className='bg-xp-tint text-brand-ink rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase'>
            Level {stats.level}
          </span>
          <TierBadge tier={stats.tier} />
          {stats.currentStreak > 0 && (
            <span className='bg-flame-tint text-flame-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase'>
              <Flame className='size-3' aria-hidden />
              {plural(stats.currentStreak, "day")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
