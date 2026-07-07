"use client";

import { useState } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";

import { cn } from "@/lib/utils";
import { sportFromName } from "@/lib/sports";
import { SportIcon } from "@/components/design-system/sport-chip";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { Button } from "@/components/ui/button";

export type RoutineSessionItemProps = {
  sportName: string | null;
  /** Session time as HH:MM, if set. */
  time: string | null;
  /** A completed log for this sport exists on this day. */
  done: boolean;
  /** Whether the rendered day is today — computed on the server page. */
  isToday: boolean;
};

/**
 * Calendar routine row rendered as a clickable row that opens a read-only
 * detail sheet — the same pattern as DayPlanItems. Routines are logged from
 * Today (the dashboard WorkoutCard), so the sheet links there on the session's
 * day and to /onboarding (the routine editor) otherwise.
 */
export function RoutineSessionItem({
  sportName,
  time,
  done,
  isToday,
}: RoutineSessionItemProps) {
  const [open, setOpen] = useState(false);
  const sport = sportFromName(sportName);
  const name = sportName ?? "Workout";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:bg-secondary -mx-1 flex w-full items-center gap-2.5 rounded-md p-1 text-left text-sm transition-colors"
      >
        <SportIcon sport={sport} className="size-7 shrink-0" />
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            done && "text-muted-foreground line-through",
          )}
        >
          {name}
          {time ? ` · ${time}` : ""}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
          <Repeat className="size-3" aria-hidden />
          routine
        </span>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={name}
        description={time ? `Every week at ${time}` : "Every week"}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <SportIcon sport={sport} className="size-9 shrink-0" />
            <p className="text-muted-foreground text-sm leading-relaxed">
              Recurring routine ·{" "}
              <Link
                href="/onboarding"
                className="text-brand-ink font-medium hover:underline"
              >
                edit it in your week
              </Link>
            </p>
          </div>

          {isToday ? (
            <Button asChild variant="brand" className="w-full">
              <Link href="/dashboard">Log it on Today</Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">
              You can log this from Today on its day.
            </p>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
