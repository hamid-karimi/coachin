import * as React from "react";
import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  days: number;
  className?: string;
}

export function StreakBadge({ days, className }: StreakBadgeProps) {
  return (
    <span
      className={cn(
        "bg-flame-tint text-flame-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      <Flame className="size-3.5" aria-hidden />
      {days}-day streak
    </span>
  );
}
