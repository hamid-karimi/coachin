"use client";

import { LeaderboardRow } from "@/components/design-system/leaderboard-row";
import type { Tier } from "@/components/design-system/tier-badge";
import { initials } from "@/app/(app)/dashboard/lib/today";
import { useCoachingHub } from "../hooks/use-coaching";
import { weeklyRanking } from "../lib/coaching";

/** Trainees ranked by XP earned this week. */
export function TraineeLeaderboard() {
  const ranked = weeklyRanking(useCoachingHub().trainees);
  return (
    <section className='bg-card border-border space-y-2 rounded-xl border p-4'>
      <div>
        <h2 className='text-[15px] font-bold'>Trainee leaderboard</h2>
        <p className='text-muted-foreground text-xs'>Your trainees, ranked by XP earned this week</p>
      </div>
      {ranked.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No trainees yet — share an invite code to connect.</p>
      ) : (
        <div className='-mx-4'>
          {ranked.map((t, index) => (
            <LeaderboardRow
              key={t.id}
              rank={index + 1}
              name={t.name}
              initials={initials(t.name)}
              xp={t.weeklyXp}
              tier={t.tier as Tier}
              avatarUrl={t.avatarUrl ?? undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
