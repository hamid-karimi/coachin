"use client";

import { cn } from "@/lib/utils";
import type { CommitmentType } from "../lib/commitments";

export const COMMITMENT_TYPES: { value: CommitmentType; label: string; hint: string }[] = [
  { value: "fixed", label: "Fixed session", hint: "Repeats on a set day — your streak expects it." },
  {
    value: "target",
    label: "Weekly target",
    hint: "A number of sessions per week, on any days — progress only, no streak pressure.",
  },
];

interface CommitmentTypeSwitchProps {
  value: CommitmentType;
  onChange: (value: CommitmentType) => void;
}

/** Segmented switch between the two commitment types. */
export function CommitmentTypeSwitch({ value, onChange }: CommitmentTypeSwitchProps) {
  return (
    <div role='radiogroup' aria-label='Commitment type' className='bg-secondary flex gap-1 rounded-lg p-1'>
      {COMMITMENT_TYPES.map((entry) => {
        const active = value === entry.value;
        return (
          <button
            key={entry.value}
            type='button'
            role='radio'
            aria-checked={active}
            onClick={() => onChange(entry.value)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}>
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
