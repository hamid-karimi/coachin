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
  /** Context line under the name, e.g. "↑ 2 since last week". */
  subtitle?: string;
  className?: string;
}

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export function LeaderboardRow({
  rank,
  name,
  initials,
  xp,
  tier,
  avatarUrl,
  highlight = false,
  subtitle,
  className,
}: LeaderboardRowProps) {
  const medal = MEDALS[rank];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        highlight &&
          "bg-brand-tint border-brand/35 rounded-lg border",
        className,
      )}
    >
      <span
        className={cn(
          "w-6 shrink-0 text-center text-stat text-sm",
          highlight ? "text-brand-ink" : "text-muted-foreground",
        )}
        aria-label={`Rank ${rank}`}
      >
        {medal ?? rank}
      </span>
      <Avatar
        className={cn("size-9", highlight && "ring-brand ring-2 ring-offset-1 ring-offset-background")}
      >
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback
          className={cn(
            highlight && "bg-brand text-brand-foreground font-bold",
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-sm font-semibold">
          {name}
          {highlight && (
            <span className="text-brand-ink ml-1.5 text-[11px] font-bold tracking-wide">
              YOU
            </span>
          )}
        </p>
        {subtitle ? (
          <p className="text-muted-foreground truncate text-xs">{subtitle}</p>
        ) : null}
      </div>
      {tier ? <TierBadge tier={tier} className="shrink-0" /> : null}
      <span className="text-foreground shrink-0 text-stat text-sm">
        {xp.toLocaleString()}
      </span>
    </div>
  );
}
