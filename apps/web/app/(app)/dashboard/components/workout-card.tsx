"use client";

import { Check, Flame } from "lucide-react";
import { SportIcon } from "@/components/design-system/sport-chip";
import { Button } from "@/components/ui/button";
import { useConfettiBurst } from "@/components/hooks/use-confetti-burst";
import type { components } from "@/lib/api/schema";
import { sportFromName } from "@/lib/sports";
import { useLogWorkout } from "../hooks/use-today";
import { multiplierSuffix } from "../lib/today";

type Session = components["schemas"]["TodaySessionBody"];

interface WorkoutCardProps {
  session: Session;
  streak: number;
  bestStreak: number;
}

/**
 * A fixed session: one tap to log it, then the reward moment (XP earned,
 * streak) with confetti; sessions logged earlier today show as done.
 */
export function WorkoutCard({ session, streak, bestStreak }: WorkoutCardProps) {
  const log = useLogWorkout();
  useConfettiBurst(log.isSuccess);
  const name = session.sportName ?? "Session";
  const suffix = multiplierSuffix(session.multiplier);

  if (log.isSuccess) {
    const nextStreak = streak + 1;
    return (
      <div className='bg-success-tint border-success/25 animate-in fade-in zoom-in-95 rounded-xl border p-4 duration-500'>
        <div className='flex items-center gap-3.5'>
          <span className='bg-success/15 text-success grid size-11 shrink-0 place-items-center rounded-lg'>
            <Check className='size-5' aria-hidden />
          </span>
          <div className='min-w-0 flex-1'>
            <p className='text-foreground text-[15px] font-semibold'>{name} logged!</p>
            <p className='text-success text-[13px] font-semibold'>
              +{log.data.earnedXp} XP earned{suffix}
            </p>
          </div>
          <span className='text-brand-ink text-stat text-xl'>+{log.data.earnedXp}</span>
        </div>
        <div className='border-success/20 mt-3 flex items-center gap-2 border-t pt-3'>
          <Flame className='text-flame fill-flame/30 size-4' aria-hidden />
          <p className='text-muted-foreground text-[13px]'>
            <span className='text-foreground font-semibold'>
              Streak: {nextStreak} {nextStreak === 1 ? "day" : "days"}
            </span>
            {bestStreak > 0 && ` · best ${Math.max(bestStreak, nextStreak)}`}
          </p>
        </div>
      </div>
    );
  }

  if (session.completed) {
    return (
      <div className='bg-success-tint border-success/25 flex items-center gap-3.5 rounded-xl border p-4'>
        <span className='bg-success/15 text-success grid size-11 shrink-0 place-items-center rounded-lg'>
          <Check className='size-5' aria-hidden />
        </span>
        <div className='min-w-0 flex-1'>
          <p className='text-foreground/80 decoration-foreground/40 truncate text-[15px] font-semibold line-through'>
            {name}
          </p>
          <p className='text-success text-[13px] font-semibold'>
            Done · +{session.estimatedXp} XP{suffix}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-card border-border flex items-center gap-3.5 rounded-xl border p-4'>
      <SportIcon sport={sportFromName(session.sportName)} />
      <div className='min-w-0 flex-1'>
        <p className='text-foreground truncate text-[15px] font-semibold'>{name}</p>
        <p className='text-muted-foreground text-[13px]'>
          {session.time ? `${session.time} · ` : ""}+{session.estimatedXp} XP
          {session.multiplier !== 1 && <span className='text-brand-ink font-semibold'> · {session.multiplier}×</span>}
        </p>
      </div>
      <Button
        type='button'
        variant='brand'
        disabled={log.isPending || session.sportTypeId === null}
        onClick={() => session.sportTypeId !== null && log.mutate({ body: { sportTypeId: session.sportTypeId } })}>
        {log.isPending ? "Logging…" : "Log it"}
      </Button>
    </div>
  );
}
