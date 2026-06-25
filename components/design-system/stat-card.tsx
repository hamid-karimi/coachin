import * as React from "react";

import { cn } from "@/lib/utils";

type StatAccent = "default" | "brand" | "xp" | "flame";

const ACCENTS: Record<StatAccent, string> = {
  default: "text-foreground",
  brand: "text-brand-ink",
  xp: "text-xp-ink",
  flame: "text-flame-ink",
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
        "bg-secondary flex flex-col gap-1 rounded-md p-4",
        className,
      )}
    >
      <span className="text-muted-foreground text-[13px]">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-2xl font-medium",
          ACCENTS[accent],
        )}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
