import * as React from "react";
import { Footprints, Dumbbell, Waves, Bike, Activity } from "lucide-react";

import { cn } from "@/lib/utils";

export type Sport = "running" | "strength" | "swimming" | "cycling" | "mobility";

const SPORTS: Record<
  Sport,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  running: { label: "Running", icon: Footprints },
  strength: { label: "Strength", icon: Dumbbell },
  swimming: { label: "Swimming", icon: Waves },
  cycling: { label: "Cycling", icon: Bike },
  mobility: { label: "Mobility", icon: Activity },
};

export function sportMeta(sport: Sport) {
  return SPORTS[sport];
}

interface SportChipProps {
  sport: Sport;
  /** XP multiplier, e.g. 1.5 — highlighted in volt when above 1×. */
  multiplier?: number;
  selected?: boolean;
  className?: string;
}

/**
 * Neutral raised pill — sports stay quiet so the action color can be loud.
 * The multiplier is surfaced right on the chip so XP math is legible.
 */
export function SportChip({
  sport,
  multiplier,
  selected = false,
  className,
}: SportChipProps) {
  const { label, icon: Icon } = SPORTS[sport];
  const boosted = (multiplier ?? 1) > 1;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
        selected
          ? "border-brand bg-secondary text-foreground"
          : "border-border bg-secondary text-foreground",
        className,
      )}
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      {label}
      {multiplier !== undefined && (
        <span
          className={cn(
            "text-xs",
            boosted ? "text-brand-ink font-bold" : "text-muted-foreground",
          )}
        >
          {multiplier}×
        </span>
      )}
    </span>
  );
}

interface SportIconProps {
  sport: Sport;
  className?: string;
}

/** Volt-tinted icon tile used on workout cards and schedule items. */
export function SportIcon({ sport, className }: SportIconProps) {
  const { icon: Icon } = SPORTS[sport];
  return (
    <span
      className={cn(
        "bg-xp-tint text-brand-ink inline-flex size-11 items-center justify-center rounded-lg",
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
