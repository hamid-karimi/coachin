import * as React from "react";

import { cn } from "@/lib/utils";

type StatAccent = "default" | "brand" | "xp" | "flame" | "gold";

const ACCENTS: Record<StatAccent, string> = {
  default: "text-foreground",
  brand: "text-brand-ink",
  xp: "text-xp-ink",
  flame: "text-flame-ink",
  gold: "text-tier-gold",
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  accent?: StatAccent;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  accent = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-card border-border flex flex-col gap-1 rounded-xl border p-4",
        className,
      )}
    >
      <span className="text-overline">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-2xl text-stat",
          ACCENTS[accent],
        )}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
