import * as React from "react";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface XpBarProps {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  /** Lifetime XP, shown top-right when provided. */
  totalXp?: number;
  className?: string;
}

/**
 * Level progress with the mechanics explained where they're felt:
 * how far to the next level, and that every 1,000 XP levels you up.
 */
export function XpBar({
  level,
  currentXp,
  nextLevelXp,
  totalXp,
  className,
}: XpBarProps) {
  const pct = Math.min(
    100,
    Math.round((currentXp / Math.max(1, nextLevelXp)) * 100),
  );
  const remaining = Math.max(0, nextLevelXp - currentXp);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-foreground text-[15px] font-bold">
          Level {level}
        </span>
        <span className="text-muted-foreground text-xs text-stat font-medium">
          {totalXp !== undefined
            ? `${totalXp.toLocaleString()} total XP`
            : `${currentXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP`}
        </span>
      </div>
      <Progress
        value={pct}
        className="h-1.5"
        aria-label={`Level ${level} progress`}
      />
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground text-xs">
          {remaining.toLocaleString()} XP to Level {level + 1}
        </span>
        <span
          className="text-muted-foreground/70 cursor-help text-xs"
          title="Every logged workout earns XP × its sport multiplier. Every 1,000 XP = 1 level."
        >
          How XP works ›
        </span>
      </div>
    </div>
  );
}
