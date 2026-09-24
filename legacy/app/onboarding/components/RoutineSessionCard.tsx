"use client";

import { X } from "lucide-react";

import { SportIcon } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";

interface RoutineSessionCardProps {
  /** `sport_types.name` for this schedule row. */
  name?: string;
  /** Stored as HH:MM:SS; only HH:MM is shown. */
  time?: string | null;
  /** Full day name, used for the remove button's accessible label. */
  dayName: string;
  isDeleting?: boolean;
  onDelete: () => void;
}

/**
 * Editable card for a manual recurring-routine session. Brand-tinted so it
 * reads as "yours to edit" next to the neutral read-only AI plan cards, and
 * carries the delete affordance.
 */
export function RoutineSessionCard({
  name,
  time,
  dayName,
  isDeleting = false,
  onDelete,
}: RoutineSessionCardProps) {
  return (
    <div className="bg-brand-tint border-brand/25 flex items-center gap-3 rounded-lg border p-3">
      <SportIcon
        sport={sportFromName(name)}
        className="size-9 shrink-0 rounded-md"
      />
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-semibold">
          {name ?? "Session"}
        </p>
        {time && (
          <p className="text-muted-foreground text-xs">{time.slice(0, 5)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={`Remove ${name ?? "session"} on ${dayName}`}
        className="text-muted-foreground hover:text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md disabled:opacity-50"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
