"use client";

import Link from "next/link";
import { MoonStar, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanItemRow } from "../../components/plan-item-row";
import { useToday } from "../hooks/use-today";
import { WorkoutCard } from "./workout-card";

function RestDay() {
  return (
    <div className='border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center'>
      <span className='bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full'>
        <MoonStar className='size-5' aria-hidden />
      </span>
      <p className='text-foreground font-semibold'>Rest day</p>
      <p className='text-muted-foreground max-w-70 text-sm leading-relaxed'>
        Nothing scheduled — recovery counts. Your streak is safe on rest days.
      </p>
      <Button asChild variant='secondary' size='sm' className='mt-1'>
        <Link href='/onboarding'>Edit plan</Link>
      </Button>
    </div>
  );
}

/** Today's fixed sessions and AI plan items, with the done/total tally. */
export function TodaysPlan() {
  const { date, sessions, planItems, planWeek, hardCollision, doneCount, totalCount, stats } = useToday();

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between'>
        <h2 className='text-foreground text-[17px] font-bold'>Today&apos;s plan</h2>
        {totalCount > 0 && (
          <span className='text-muted-foreground text-[13px]'>
            {doneCount} of {totalCount} done
          </span>
        )}
      </div>

      {sessions.length === 0 && planItems.length === 0 ? (
        <RestDay />
      ) : (
        <div className='grid gap-3'>
          {sessions.map((session) => (
            <WorkoutCard
              key={session.scheduleId}
              session={session}
              streak={stats.currentStreak}
              bestStreak={stats.bestStreak}
            />
          ))}
          {planItems.length > 0 && (
            <div className='flex flex-col gap-2'>
              <p className='text-overline flex items-center justify-between'>
                <span>From your plan</span>
                <Link href='/training' className='text-brand-ink text-[11px] font-medium normal-case hover:underline'>
                  Week {planWeek} →
                </Link>
              </p>
              {hardCollision && (
                <p className='bg-flame-tint text-flame-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium'>
                  <TriangleAlert className='size-3.5' aria-hidden />2 intense workouts today — consider spacing them.
                </p>
              )}
              {planItems.map((item) => (
                <PlanItemRow key={item.id} item={item} date={item.date} today={date} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
