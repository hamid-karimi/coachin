"use client";

import Link from "next/link";
import { CalendarHeart, CalendarPlus, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrograms } from "../hooks/use-programs";
import { ProgramCard } from "./program-card";

function EmptyPrograms() {
  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col items-center gap-4 py-16 text-center'>
      <span className='bg-brand-tint text-brand-ink grid size-14 place-items-center rounded-2xl'>
        <CalendarHeart className='size-7' aria-hidden />
      </span>
      <h1 className='text-foreground font-display text-2xl font-bold tracking-tight'>My programs</h1>
      <p className='text-muted-foreground max-w-md text-sm'>
        Create a training plan — running or building muscle — and get an AI-generated week-by-week program with
        sessions, strength, mobility, recovery, and fueling notes. You can run one program per discipline at once.
      </p>
      <Button asChild variant='brand' size='lg'>
        <Link href='/training/new'>
          <Plus aria-hidden />
          Create a plan
        </Link>
      </Button>
      <Button asChild variant='ghost' size='sm'>
        <Link href='/onboarding'>
          <Pencil aria-hidden />
          Edit routine
        </Link>
      </Button>
    </div>
  );
}

/** "My programs": every active plan as a card, or the create-a-plan pitch. */
export function ProgramsView() {
  const programs = usePrograms();
  if (programs.length === 0) return <EmptyPrograms />;

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-6'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
            My programs
          </h1>
          <p className='text-muted-foreground text-sm'>
            Your active training plans — one per discipline. Your day-by-day schedule lives in Calendar; here you
            create, archive, and review.
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button asChild variant='brand' size='sm'>
            <Link href='/training/new'>
              <Plus aria-hidden />
              New plan
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <Link href='/onboarding'>
              <Pencil aria-hidden />
              Edit routine
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm'>
            <a href='/api/v1/training/calendar.ics' download>
              <CalendarPlus aria-hidden />
              Add to calendar
            </a>
          </Button>
        </div>
      </div>
      <div className='flex flex-col gap-4'>
        {programs.map((program) => (
          <ProgramCard key={program.id} program={program} />
        ))}
      </div>
    </div>
  );
}
