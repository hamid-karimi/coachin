"use client";

import { SportChip } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";

export interface SportOption {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

interface SportPickerProps {
  sports: SportOption[];
  /** Selected sport id as a string; "" = none selected. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Sport chip row shared by both add-commitment forms. Clicking the active
 * chip clears the selection. Deliberately shows NO XP multiplier — picking a
 * commitment is not the moment for XP math.
 */
export function SportPicker({
  sports,
  value,
  onChange,
  disabled = false,
}: SportPickerProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      {sports.map((sport) => {
        const chipValue = String(sport.id);
        const active = value === chipValue;
        return (
          <button
            key={sport.id}
            type='button'
            onClick={() => onChange(active ? "" : chipValue)}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              "rounded-full transition-all disabled:opacity-50",
              active
                ? "ring-brand ring-offset-background ring-2 ring-offset-2"
                : "opacity-80 hover:opacity-100",
            )}>
            <SportChip
              sport={sportFromName(sport.name)}
              label={sport.name}
              selected={active}
            />
          </button>
        );
      })}
    </div>
  );
}
