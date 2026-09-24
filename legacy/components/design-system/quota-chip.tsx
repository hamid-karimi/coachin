import { cn } from "@/lib/utils";

interface QuotaChipProps {
  name: string;
  done: number;
  target: number;
  className?: string;
}

/**
 * Compact weekly-target progress pill — "Running 1/2". Met (`done >= target`)
 * renders in the brand tint; unmet stays quiet. Purely presentational and
 * server-compatible; quotas are informational only (no streak/hearts/XP —
 * see FORMULAS.md §11 Weekly quotas).
 */
export function QuotaChip({ name, done, target, className }: QuotaChipProps) {
  const met = done >= target;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        met
          ? "bg-brand-tint text-brand-ink"
          : "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {name} {done}/{target}
    </span>
  );
}
