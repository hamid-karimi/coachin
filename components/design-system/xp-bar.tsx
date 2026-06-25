import * as React from "react";
import { Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface XpBarProps {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  className?: string;
}

export function XpBar({ level, currentXp, nextLevelXp, className }: XpBarProps) {
  const pct = Math.min(
    100,
    Math.round((currentXp / Math.max(1, nextLevelXp)) * 100),
  );
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Zap className="text-xp size-4" aria-hidden />
          Level {level}
        </span>
        <span className="text-muted-foreground text-sm">
          {currentXp.toLocaleString()} / {nextLevelXp.toLocaleString()} XP
        </span>
      </div>
      <Progress value={pct} aria-label={`Level ${level} progress`} />
    </div>
  );
}
