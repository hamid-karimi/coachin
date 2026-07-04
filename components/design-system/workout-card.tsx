"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SportIcon, sportMeta, type Sport } from "./sport-chip";

interface WorkoutCardProps {
  sport: Sport;
  time?: string;
  xp: number;
  status?: "pending" | "done";
  onLog?: () => void;
  className?: string;
}

export function WorkoutCard({
  sport,
  time,
  xp,
  status = "pending",
  onLog,
  className,
}: WorkoutCardProps) {
  const meta = sportMeta(sport);
  const done = status === "done";

  if (done) {
    return (
      <div
        className={cn(
          "bg-success-tint border-success/25 flex items-center gap-3.5 rounded-xl border p-4",
          className,
        )}
      >
        <span className="bg-success/15 text-success grid size-11 shrink-0 place-items-center rounded-lg">
          <Check className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground/80 truncate text-[15px] font-semibold line-through decoration-foreground/40">
            {meta.label}
          </p>
          <p className="text-success text-[13px] font-semibold">
            Done · +{xp} XP earned
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-card border-border flex items-center gap-3.5 rounded-xl border p-4",
        className,
      )}
    >
      <SportIcon sport={sport} />
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-[15px] font-semibold">
          {meta.label}
        </p>
        <p className="text-muted-foreground text-[13px]">
          {time ? `${time} · ` : ""}+{xp} XP
        </p>
      </div>
      <Button variant="brand" onClick={onLog}>
        Log it
      </Button>
    </div>
  );
}
