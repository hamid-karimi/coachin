"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AddFixedSessionForm } from "./AddFixedSessionForm";
import { AddWeeklyTargetForm } from "./AddWeeklyTargetForm";
import type { SportOption } from "./SportPicker";

const COMMITMENT_TYPES = [
  {
    value: "fixed",
    label: "Fixed session",
    hint: "Repeats on a set day — your streak expects it.",
  },
  {
    value: "target",
    label: "Weekly target",
    hint: "A number of sessions per week, on any days — progress only, no streak pressure.",
  },
] as const;

type CommitmentType = (typeof COMMITMENT_TYPES)[number]["value"];

interface AddCommitmentSectionProps {
  sports: SportOption[];
  /** Days (0-6) that already have a fixed session, for the day-strip dots. */
  plannedDays: number[];
}

/**
 * Segmented switch between the two commitment types (same radiogroup pattern
 * as the training intake wizard). One form visible at a time keeps the editor
 * calm — stacking both would nearly double the page.
 */
export function AddCommitmentSection({
  sports,
  plannedDays,
}: AddCommitmentSectionProps) {
  const [type, setType] = useState<CommitmentType>("fixed");
  const activeType =
    COMMITMENT_TYPES.find((entry) => entry.value === type) ??
    COMMITMENT_TYPES[0];

  return (
    <section className='mb-6 flex flex-col gap-4'>
      <div
        role='radiogroup'
        aria-label='Commitment type'
        className='bg-secondary flex gap-1 rounded-lg p-1'>
        {COMMITMENT_TYPES.map((entry) => {
          const active = type === entry.value;
          return (
            <button
              key={entry.value}
              type='button'
              role='radio'
              aria-checked={active}
              onClick={() => setType(entry.value)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}>
              {entry.label}
            </button>
          );
        })}
      </div>

      <p className='text-muted-foreground text-xs'>{activeType.hint}</p>

      {type === "fixed" ? (
        <AddFixedSessionForm sports={sports} plannedDays={plannedDays} />
      ) : (
        <AddWeeklyTargetForm sports={sports} />
      )}
    </section>
  );
}
