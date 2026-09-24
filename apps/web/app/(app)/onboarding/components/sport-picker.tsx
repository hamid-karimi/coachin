"use client";

import { SportChip } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";
import type { SportType } from "./types";

interface SportPickerProps {
  sports: SportType[];
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * Sport chip row. Clicking the active chip clears the selection. Deliberately
 * shows NO XP multiplier — picking a commitment is not the moment for XP math.
 */
export function SportPicker({ sports, value, onChange }: SportPickerProps) {
  return (
    <div className='flex flex-wrap gap-2'>
      {sports.map((sport) => {
        const active = value === sport.id;
        return (
          <button
            key={sport.id}
            type='button'
            onClick={() => onChange(active ? null : sport.id)}
            aria-pressed={active}
            className={cn(
              "rounded-full transition-all disabled:opacity-50",
              active ? "ring-brand ring-offset-background ring-2 ring-offset-2" : "opacity-80 hover:opacity-100",
            )}>
            <SportChip sport={sportFromName(sport.name)} label={sport.name} selected={active} />
          </button>
        );
      })}
    </div>
  );
}
