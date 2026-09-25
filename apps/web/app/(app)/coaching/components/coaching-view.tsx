"use client";

import { useCoachingHub } from "../hooks/use-coaching";
import { rosterLine } from "../lib/coaching";
import { InviteCodesCard } from "./invite-codes-card";
import { TraineeLeaderboard } from "./trainee-leaderboard";
import { TraineeRow } from "./trainee-row";

/** The coach hub: roster with this week's adherence, invite codes, weekly ranking. */
export function CoachingView() {
  const { trainees } = useCoachingHub();
  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
      <header>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>Coaching</h1>
        <p className='text-muted-foreground text-sm'>{rosterLine(trainees.length)}</p>
      </header>
      <section className='bg-card border-border space-y-4 rounded-xl border p-4'>
        <h2 className='text-[15px] font-bold'>My trainees{trainees.length > 0 ? ` · ${trainees.length}` : ""}</h2>
        {trainees.length > 0 ? (
          <ul className='space-y-2'>
            {trainees.map((trainee) => (
              <TraineeRow key={`${trainee.id}-${trainee.sport?.id ?? 0}`} trainee={trainee} />
            ))}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>No trainees yet — share an invite code to connect.</p>
        )}
      </section>
      <InviteCodesCard />
      <TraineeLeaderboard />
    </div>
  );
}
