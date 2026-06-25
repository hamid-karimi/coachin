import * as React from "react";
import { Trophy, Medal, Award, Crown } from "lucide-react";

import { cn } from "@/lib/utils";

export type Tier = "bronze" | "silver" | "gold" | "platinum";

const TIERS: Record<
  Tier,
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  bronze: { label: "Bronze league", icon: Medal, className: "bg-flame-tint text-flame-ink" },
  silver: { label: "Silver league", icon: Award, className: "bg-secondary text-secondary-foreground" },
  gold: { label: "Gold league", icon: Trophy, className: "bg-xp-tint text-xp-ink" },
  platinum: { label: "Platinum league", icon: Crown, className: "bg-[#EEEDFE] text-[#3C3489]" },
};

interface TierBadgeProps {
  tier: Tier;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const { label, icon: Icon, className: tone } = TIERS[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
