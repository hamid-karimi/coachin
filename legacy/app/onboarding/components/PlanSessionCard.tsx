"use client";

import { ChevronRight, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { planItemDetailLine } from "@/lib/plan-items";
import { PlanTypeIcon } from "./PlanTypeIcon";
import type { PlanWeekItem } from "../actions";

/**
 * Clickable card for an AI-generated plan session. Neutral-tinted to sit apart
 * from the editable brand-tinted routine cards, and tapping it opens the detail
 * sheet. The plan itself is edited in /training, so there's no delete here.
 */
export function PlanSessionCard({
  item,
  onSelect,
}: {
  item: PlanWeekItem;
  onSelect: (item: PlanWeekItem) => void;
}) {
  const detail = planItemDetailLine(item.details);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="bg-secondary border-border hover:border-muted-foreground/40 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors"
    >
      <span className="bg-background text-muted-foreground grid size-9 shrink-0 place-items-center rounded-md">
        <PlanTypeIcon type={item.item_type} className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              "text-foreground min-w-0 truncate text-sm font-semibold",
              item.is_completed && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </p>
          <span className="border-border text-muted-foreground inline-flex shrink-0 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
            <Sparkles className="size-2.5" aria-hidden />
            AI plan
          </span>
        </div>
        {detail && (
          <p className="text-muted-foreground mt-0.5 text-xs">{detail}</p>
        )}
      </div>
      <ChevronRight
        className="text-muted-foreground/60 size-4 shrink-0"
        aria-hidden
      />
    </button>
  );
}
