"use client";

import { Flame, Heart } from "lucide-react";
import { StatCard } from "@/components/design-system/stat-card";
import { cn } from "@/lib/utils";
import { useToday } from "@/app/(app)/dashboard/hooks/use-today";
import { useProfileOverview } from "../hooks/use-profile";

const HEART_SLOTS = [0, 1, 2];

/** Total XP / streak / best streak / workouts, then the hearts explainer. */
export function ProfileStats() {
  const { stats } = useToday();
  const { workoutCount } = useProfileOverview();
  return (
    <>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <StatCard label='Total XP' value={stats.xp.toLocaleString("en-US")} />
        <StatCard
          label='Streak'
          value={
            <>
              {stats.currentStreak}
              <Flame className='text-flame fill-flame/30 size-4.5' aria-hidden />
            </>
          }
        />
        <StatCard label='Best streak' value={stats.bestStreak} />
        <StatCard label='Workouts' value={workoutCount} />
      </div>
      <div className='bg-card border-border flex items-center gap-3 rounded-xl border p-4'>
        <div className='flex gap-1'>
          {HEART_SLOTS.map((index) => (
            <Heart
              key={index}
              className={cn(
                "size-5",
                index < stats.hearts ? "fill-destructive text-destructive" : "text-muted-foreground/40",
              )}
              aria-hidden
            />
          ))}
        </div>
        <p className='text-muted-foreground text-[13px]'>
          <span className='text-foreground font-semibold'>{stats.hearts} of 3 hearts.</span> A missed training day costs
          one — at 0, your streak resets.
        </p>
      </div>
    </>
  );
}
