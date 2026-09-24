"use client";

import { useState } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { SportIcon } from "@/components/design-system/sport-chip";
import { Button } from "@/components/ui/button";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { routineLabel, type CalendarRoutine } from "../lib/calendar";

/**
 * A routine row that opens a read-only sheet. Routines are logged on Today,
 * so the sheet links there on the session's own day.
 */
export function RoutineSessionItem({ routine, isToday }: { routine: CalendarRoutine; isToday: boolean }) {
  const [open, setOpen] = useState(false);
  const sport = sportFromName(routine.sportName);
  const name = routine.sportName ?? "Workout";

  return (
    <>
      <button
        type='button'
        onClick={() => setOpen(true)}
        className='hover:bg-secondary -mx-1 flex w-full items-center gap-2.5 rounded-md p-1 text-left text-sm transition-colors'>
        <SportIcon sport={sport} className='size-7 shrink-0' />
        <span className={cn("min-w-0 flex-1 truncate", routine.done && "text-muted-foreground line-through")}>
          {routineLabel(routine)}
        </span>
        <span className='text-muted-foreground inline-flex items-center gap-1 text-[11px]'>
          <Repeat className='size-3' aria-hidden />
          routine
        </span>
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        description={routine.time ? `Every week at ${routine.time}` : "Every week"}>
        <div className='flex flex-col gap-4'>
          <div className='flex items-center gap-2.5'>
            <SportIcon sport={sport} className='size-9 shrink-0' />
            <p className='text-muted-foreground text-sm leading-relaxed'>
              Recurring routine ·{" "}
              <Link href='/onboarding' className='text-brand-ink font-medium hover:underline'>
                edit it in your week
              </Link>
            </p>
          </div>
          {isToday ? (
            <Button asChild variant='brand' className='w-full'>
              <Link href='/dashboard'>Log it on Today</Link>
            </Button>
          ) : (
            <p className='text-muted-foreground text-sm'>You can log this from Today on its day.</p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
