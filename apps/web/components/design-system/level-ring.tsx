import * as React from "react";

import { cn } from "@/lib/utils";

interface LevelRingProps {
  level: number;
  /** Progress toward the next level, 0–100. */
  progress: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { outer: "size-13", inner: "size-10", text: "text-base" },
  md: { outer: "size-15", inner: "size-12", text: "text-lg" },
  lg: { outer: "size-18", inner: "size-[58px]", text: "text-xl" },
};

/**
 * Conic-gradient level ring: volt arc for progress toward the next level,
 * the current level number in the middle.
 */
export function LevelRing({
  level,
  progress,
  size = "md",
  className,
}: LevelRingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const { outer, inner, text } = SIZES[size];

  return (
    <div
      role="img"
      aria-label={`Level ${level}, ${pct}% to next level`}
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        outer,
        className,
      )}
      style={{
        background: `conic-gradient(var(--brand) 0 ${pct}%, var(--border) ${pct}% 100%)`,
      }}
    >
      <div
        className={cn(
          "bg-card text-brand-ink grid place-items-center rounded-full font-bold text-stat",
          inner,
          text,
        )}
      >
        {level}
      </div>
    </div>
  );
}
