"use client";

import Link from "next/link";
import { StreakBadge } from "@/components/design-system/streak-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToday } from "../hooks/use-today";
import { dateLabel, firstName, initials } from "../lib/today";

export function TodayHeader({ name }: { name: string }) {
  const { date, stats } = useToday();
  return (
    <div className='flex items-center justify-between gap-4'>
      <div>
        <p className='text-muted-foreground text-[13px]'>{dateLabel(date)}</p>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
          {`Hi, ${firstName(name)}`}
        </h1>
      </div>
      <div className='flex items-center gap-2.5'>
        <StreakBadge days={stats.currentStreak} compact />
        <Link href='/profile' aria-label='Open profile'>
          <Avatar className='size-10'>
            <AvatarFallback className='font-semibold'>{initials(name)}</AvatarFallback>
          </Avatar>
        </Link>
      </div>
    </div>
  );
}
