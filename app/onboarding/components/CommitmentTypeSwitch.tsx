"use client";

import { cn } from "@/lib/utils";

export const COMMITMENT_TYPES = [
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

export type CommitmentType = (typeof COMMITMENT_TYPES)[number]["value"];

interface CommitmentTypeSwitchProps {
  value: CommitmentType;
  onChange: (value: CommitmentType) => void;
}

/**
 * Segmented switch between the two commitment types (same radiogroup pattern
 * as the training intake wizard).
 */
export function CommitmentTypeSwitch({
  value,
  onChange,
}: CommitmentTypeSwitchProps) {
  return (
    <div
      role='radiogroup'
      aria-label='Commitment type'
      className='bg-secondary flex gap-1 rounded-lg p-1'>
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
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}>
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}
