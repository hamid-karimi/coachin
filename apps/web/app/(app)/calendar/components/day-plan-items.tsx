"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { PlanSessionSheet } from "../../components/plan-session-sheet";
import { PlanTypeIcon } from "../../components/plan-type-icon";

type PlanItem = components["schemas"]["PlanItemBody"];

/** A day's plan sessions as rows opening the read-only detail sheet (plans are edited in Training). */
export function DayPlanItems({ items }: { items: PlanItem[] }) {
  const [selected, setSelected] = useState<PlanItem | null>(null);
  return (
    <>
      {items.map((item) => (
        <button
          key={item.id}
          type='button'
          onClick={() => setSelected(item)}
          className='hover:bg-secondary -mx-1 flex w-full items-center gap-2.5 rounded-md p-1 text-left text-sm transition-colors'>
          <span className='bg-brand-tint text-brand-ink grid size-7 shrink-0 place-items-center rounded-lg'>
            <PlanTypeIcon type={item.itemType} className='size-4' />
          </span>
          <span className={cn("min-w-0 flex-1 truncate", item.isCompleted && "text-muted-foreground line-through")}>
            {item.title}
          </span>
          <ChevronRight className='text-muted-foreground/60 size-4 shrink-0' aria-hidden />
        </button>
      ))}
      <PlanSessionSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}
