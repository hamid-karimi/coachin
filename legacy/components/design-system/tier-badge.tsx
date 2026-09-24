import * as React from "react";

import { cn } from "@/lib/utils";

export type Tier = "bronze" | "silver" | "gold" | "platinum";

const TIERS: Record<Tier, { label: string; className: string }> = {
  bronze: {
    label: "Bronze",
    className: "bg-tier-bronze-tint text-tier-bronze",
  },
  silver: {
    label: "Silver",
    className: "bg-tier-silver-tint text-tier-silver",
  },
  gold: { label: "Gold", className: "bg-tier-gold-tint text-tier-gold" },
  platinum: {
    label: "Platinum",
    className: "bg-tier-platinum-tint text-tier-platinum",
  },
};

interface TierBadgeProps {
  tier: Tier;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const { label, className: tone } = TIERS[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.05em] uppercase",
        tone,
        className,
      )}
      aria-label={`${label} league`}
    >
      {label}
    </span>
  );
}
