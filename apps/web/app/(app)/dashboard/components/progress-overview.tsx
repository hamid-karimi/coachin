"use client";

import { Heart } from "lucide-react";
import { LevelRing } from "@/components/design-system/level-ring";
import { StatCard } from "@/components/design-system/stat-card";
import { XpBar } from "@/components/design-system/xp-bar";
import { cn } from "@/lib/utils";
import { useToday } from "../hooks/use-today";
import { levelPercent, plural, TIER_LABELS } from "../lib/today";

const HEART_SLOTS = [0, 1, 2];

/** Level card, hearts strip, and (desktop) the stat row. */
export function ProgressOverview() {
  const { stats } = useToday();
  return (
    <>
      <div className='bg-card border-border flex items-center gap-4 rounded-2xl border p-4 md:p-5'>
        <LevelRing level={stats.level} progress={levelPercent(stats.currentXp, stats.nextLevelXp)} size='lg' />
        <div className='min-w-0 flex-1'>
          <XpBar
            level={stats.level}
            currentXp={stats.currentXp}
            nextLevelXp={stats.nextLevelXp}
            totalXp={stats.xp}
          />
        </div>
      </div>

      <div className='flex items-center gap-1.5 px-0.5'>
        {HEART_SLOTS.map((index) => (
          <Heart
            key={index}
            className={cn(
              "size-4",
              index < stats.hearts ? "fill-destructive text-destructive" : "text-muted-foreground/40",
            )}
            aria-hidden
          />
        ))}
        <span className='text-muted-foreground ml-1 text-xs'>{plural(stats.hearts, "heart")} · a missed day costs one</span>
      </div>

      <div className='hidden gap-3 sm:grid sm:grid-cols-4'>
        <StatCard label='Level' value={stats.level} accent='brand' />
        <StatCard
          label='Streak'
          value={
            <>
              {stats.currentStreak}
              <span className='text-flame text-base'>🔥</span>
            </>
          }
        />
        <StatCard label='Total XP' value={stats.xp.toLocaleString()} />
        <StatCard label='League' value={TIER_LABELS[stats.tier]} accent='gold' />
      </div>
    </>
  );
}
