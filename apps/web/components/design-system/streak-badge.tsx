import * as React from "react";
import { Flame } from "lucide-react";

import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  days: number;
  /** Compact pill (count only) for tight headers. */
  compact?: boolean;
  className?: string;
}

/**
 * The streak flame — ember heat, the brand's single warm accent.
 * A dead streak (0 days) renders quiet and gray instead of celebratory.
 */
export function StreakBadge({
  days,
  compact = false,
  className,
}: StreakBadgeProps) {
  const alive = days > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
        alive
          ? "border-flame/40 bg-flame-tint text-foreground"
          : "border-border bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Flame
        className={cn(
          "size-4",
          alive ? "text-flame fill-flame/30" : "opacity-40",
        )}
        aria-hidden
      />
      <span className="text-stat text-sm">{days}</span>
      {!compact && (
        <span
          className={cn(
            "text-xs font-semibold",
            alive ? "text-flame-ink" : "text-muted-foreground",
          )}
        >
          day streak
        </span>
      )}
    </span>
  );
}
