import * as React from "react";
import { Footprints, Dumbbell, Waves, Bike, Activity } from "lucide-react";

import { cn } from "@/lib/utils";

export type Sport = "running" | "strength" | "swimming" | "cycling" | "mobility";

const SPORTS: Record<
  Sport,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  running: { label: "Running", icon: Footprints, className: "bg-brand-tint text-brand-ink" },
  strength: { label: "Strength", icon: Dumbbell, className: "bg-[#E6F1FB] text-[#0C447C]" },
  swimming: { label: "Swimming", icon: Waves, className: "bg-[#E6F1FB] text-[#185FA5]" },
  cycling: { label: "Cycling", icon: Bike, className: "bg-[#EEEDFE] text-[#3C3489]" },
  mobility: { label: "Mobility", icon: Activity, className: "bg-xp-tint text-xp-ink" },
};

export function sportMeta(sport: Sport) {
  return SPORTS[sport];
}

interface SportChipProps {
  sport: Sport;
  className?: string;
}

export function SportChip({ sport, className }: SportChipProps) {
  const { label, icon: Icon, className: tone } = SPORTS[sport];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}

interface SportIconProps {
  sport: Sport;
  className?: string;
}

export function SportIcon({ sport, className }: SportIconProps) {
  const { icon: Icon, className: tone } = SPORTS[sport];
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg",
        tone,
        className,
      )}
    >
      <Icon className="size-5" aria-hidden />
    </span>
  );
}
