"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetSupplementTaken } from "../hooks/use-supplements";
import type { Supplement } from "../lib/supplements";

/** One checklist row; the check shows the pending value right away. */
export function SupplementItem({ supplement }: { supplement: Supplement }) {
  const toggle = useSetSupplementTaken();
  const taken = toggle.isPending ? toggle.variables.body.taken : supplement.takenToday;

  return (
    <li className='flex items-center justify-between gap-3 py-1.5'>
      <div className='min-w-0'>
        <p className={cn("text-foreground truncate text-sm", taken && "text-muted-foreground line-through")}>
          {supplement.name}
        </p>
        {supplement.dose && <p className='text-muted-foreground text-xs'>{supplement.dose}</p>}
      </div>
      <button
        type='button'
        onClick={() => toggle.mutate({ params: { path: { id: supplement.id } }, body: { taken: !taken } })}
        disabled={toggle.isPending}
        aria-pressed={taken}
        aria-label={taken ? `Mark ${supplement.name} as not taken` : `Mark ${supplement.name} as taken`}
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
          taken ? "bg-brand border-brand text-brand-foreground" : "border-border text-muted-foreground hover:border-brand/50",
        )}>
        <Check className='size-3.5' aria-hidden />
      </button>
    </li>
  );
}
