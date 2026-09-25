"use client";

import { JoinCoachForm } from "@/app/(app)/profile/components/join-coach-form";
import { useCircle } from "../hooks/use-community";
import { FollowButton } from "./follow-button";
import { PeopleSearch } from "./people-search";
import { PersonRow } from "./person-row";

/** Who you follow, finding more people, and (trainees) your coaches. */
export function CircleView({ canTrain }: { canTrain: boolean }) {
  const { following, coaches } = useCircle();
  return (
    <div className='space-y-4'>
      <section className='bg-card border-border space-y-3 rounded-xl border p-4'>
        <h2 className='text-[15px] font-bold'>Following{following.length > 0 ? ` · ${following.length}` : ""}</h2>
        {following.length === 0 ? (
          <p className='text-muted-foreground text-sm'>You don&apos;t follow anyone yet — find people below.</p>
        ) : (
          <ul className='space-y-2'>
            {following.map((person) => (
              <PersonRow
                key={person.userId}
                name={person.name}
                avatarUrl={person.avatarUrl}
                tier={person.tier}
                subtitle={`Level ${person.level} · ${person.xp.toLocaleString("en-US")} XP`}>
                <FollowButton userId={person.userId} following />
              </PersonRow>
            ))}
          </ul>
        )}
      </section>
      <PeopleSearch />
      {canTrain && (
        <section className='bg-card border-border space-y-3 rounded-xl border p-4'>
          <h2 className='text-[15px] font-bold'>My coaches</h2>
          {coaches.length === 0 ? (
            <p className='text-muted-foreground text-sm'>No coach yet — add one with their invite code.</p>
          ) : (
            <ul className='space-y-2'>
              {coaches.map((coach) => (
                <PersonRow
                  key={`${coach.userId}-${coach.sport}`}
                  name={coach.name}
                  avatarUrl={coach.avatarUrl}
                  tier={coach.tier}
                  subtitle={`${coach.sport} · Level ${coach.level}`}
                />
              ))}
            </ul>
          )}
          <JoinCoachForm />
        </section>
      )}
    </div>
  );
}
