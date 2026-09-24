"use client";

import Link from "next/link";
import { Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendar } from "../hooks/use-calendar";
import { DayCard } from "./day-card";
import { WeekNav } from "./week-nav";
import { WeeklyTargets } from "./weekly-targets";

/** The week at a glance: header links, week navigation, targets, seven day cards. */
export function CalendarView() {
  const week = useCalendar();
  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>Calendar</h1>
          <p className='text-muted-foreground text-sm'>
            Your recurring routine, active plans, and logged workouts on real dates.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Button asChild variant='outline' size='sm'>
            <Link href='/onboarding'>
              <Pencil aria-hidden />
              Edit routine
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link href='/training'>
              <Sparkles aria-hidden />
              Manage programs
            </Link>
          </Button>
        </div>
      </div>
      <WeekNav week={week} />
      <WeeklyTargets quotas={week.quotas} />
      <div className='flex flex-col gap-3'>
        {week.days.map((day) => (
          <DayCard key={day.date} day={day} />
        ))}
      </div>
    </div>
  );
}
