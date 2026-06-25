import * as React from "react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TierBadge, type Tier } from "./tier-badge";

interface LeaderboardRowProps {
  rank: number;
  name: string;
  initials: string;
  xp: number;
  tier?: Tier;
  avatarUrl?: string;
  highlight?: boolean;
  className?: string;
}

export function LeaderboardRow({
  rank,
  name,
  initials,
  xp,
  tier,
  avatarUrl,
  highlight = false,
  className,
}: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        highlight && "bg-brand-tint",
        className,
      )}
    >
      <span
        className={cn(
          "w-5 text-sm font-medium",
          rank === 1 ? "text-xp-ink" : "text-muted-foreground",
          highlight && "text-brand-ink",
        )}
      >
        {rank}
      </span>
      <Avatar
        className={cn("size-8", highlight && "ring-2 ring-brand ring-offset-1")}
      >
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            highlight && "text-brand-ink",
          )}
        >
          {name}
        </p>
        {tier ? (
          <div className="mt-0.5">
            <TierBadge tier={tier} className="px-0 bg-transparent" />
          </div>
        ) : null}
      </div>
      <span
        className={cn(
          "text-sm font-medium",
          highlight ? "text-brand-ink" : "text-foreground",
        )}
      >
        {xp.toLocaleString()} XP
      </span>
    </div>
  );
}
