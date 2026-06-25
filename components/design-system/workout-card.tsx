"use client";

import * as React from "react";
import { Check, CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border p-3",
        done && "opacity-85",
        className,
      )}
    >
      <SportIcon sport={sport} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{meta.label}</p>
        <p className="text-muted-foreground text-xs">
          {done ? "Completed" : time} · +{xp} XP
        </p>
      </div>
      {done ? (
        <Badge variant="brand" className="gap-1.5">
          <CircleCheck className="size-3.5" aria-hidden />
          Done
        </Badge>
      ) : (
        <Button size="sm" variant="brand" onClick={onLog}>
          <Check className="size-4" aria-hidden />
          Log
        </Button>
      )}
    </div>
  );
}
