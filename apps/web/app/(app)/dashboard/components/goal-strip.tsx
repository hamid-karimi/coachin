"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useGoals } from "@/app/(app)/profile/hooks/use-profile";
import { featuredGoal, GOAL_META } from "@/app/(app)/profile/lib/profile";

/** The tracked goal closest to completion, linking to the profile; hidden without one. */
export function GoalStrip() {
  const goal = featuredGoal(useGoals().active);
  if (!goal?.progress) return null;
  const meta = GOAL_META[goal.goalType];
  return (
    <Link
      href='/profile'
      className='bg-card border-border hover:border-brand/40 block space-y-2 rounded-2xl border p-4 transition-colors'>
      <div className='flex items-center justify-between gap-3'>
        <span className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
          <Target className='text-brand size-4' aria-hidden />
          {meta.label} goal
        </span>
        <span className='text-muted-foreground text-[13px]'>
          {goal.current}
          {meta.unit} → {goal.target}
          {meta.unit}
        </span>
      </div>
      <Progress value={goal.progress.pct} />
    </Link>
  );
}
