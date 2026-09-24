"use client";

import type { ComponentType } from "react";
import {
  Activity,
  BedDouble,
  Check,
  Dumbbell,
  Footprints,
  Loader2,
  PersonStanding,
  Play,
  UtensilsCrossed,
} from "lucide-react";
import type { components } from "@/lib/api/schema";
import {
  isCheckable,
  logWindowOpen,
  planItemDetailLine,
  planItemVideoUrl,
  planItemVisualType,
} from "@/lib/plan-items";
import { cn } from "@/lib/utils";
import { usePlanItemCompletion } from "../hooks/use-plan-item-completion";

type PlanItem = components["schemas"]["PlanItemBody"];

const TYPE_META: Record<string, { icon: ComponentType<{ className?: string }>; tone: string }> = {
  run: { icon: Footprints, tone: "bg-brand-tint text-brand-ink" },
  strength: { icon: Dumbbell, tone: "bg-secondary text-foreground" },
  stretch: { icon: Activity, tone: "bg-xp-tint text-xp-ink" },
  mobility: { icon: PersonStanding, tone: "bg-xp-tint text-xp-ink" },
  recovery: { icon: BedDouble, tone: "bg-secondary text-muted-foreground" },
  recovery_active: { icon: Footprints, tone: "bg-secondary text-muted-foreground" },
  meal_note: { icon: UtensilsCrossed, tone: "bg-flame-tint text-flame-ink" },
};

function opensLabel(date: string): string {
  return `Opens ${new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })}`;
}

interface PlanItemRowProps {
  item: PlanItem;
  /** The item's calendar date (YYYY-MM-DD). */
  date: string;
  /** Today (YYYY-MM-DD), from the API, for the log window. */
  today: string;
}

/**
 * One AI plan item with its done toggle. Done opens on the item's day and
 * the day after; undo is always allowed. The toggle shows the pending value
 * right away (optimistic) and settles when the API answers.
 */
export function PlanItemRow({ item, date, today }: PlanItemRowProps) {
  const toggle = usePlanItemCompletion();
  const completed = toggle.isPending ? toggle.variables.body.completed : item.isCompleted;
  const meta = TYPE_META[planItemVisualType(item)] ?? TYPE_META.recovery;
  const Icon = meta.icon;
  const canMarkDone = completed || logWindowOpen(date, today);
  const label = completed ? "Mark as not done" : canMarkDone ? "Mark as done" : opensLabel(date);
  const detailLine = planItemDetailLine(item.details);
  const videoUrl = planItemVideoUrl(item.details);

  return (
    <div className={cn("border-border flex items-start gap-3 rounded-xl border p-3", completed && "opacity-70")}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", meta.tone)}>
        <Icon className='size-4' aria-hidden />
      </span>
      <div className='min-w-0 flex-1'>
        <p className={cn("text-sm font-medium", completed && "line-through")}>{item.title}</p>
        {detailLine && <p className='text-muted-foreground text-xs'>{detailLine}</p>}
        {item.description && (
          <p className='text-muted-foreground mt-0.5 text-xs whitespace-pre-line'>{item.description}</p>
        )}
        {item.details.notes && <p className='text-muted-foreground mt-0.5 text-xs'>{item.details.notes}</p>}
        {videoUrl && (
          <a
            href={videoUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-brand-ink mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline'>
            <Play className='size-3' aria-hidden />
            Watch how
          </a>
        )}
      </div>
      {isCheckable(item.itemType) && (
        <button
          type='button'
          onClick={() => toggle.mutate({ params: { path: { id: item.id } }, body: { completed: !completed } })}
          disabled={toggle.isPending || !canMarkDone}
          title={label}
          aria-label={label}
          aria-pressed={completed}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
            completed
              ? "bg-brand border-brand text-brand-foreground"
              : "border-border text-muted-foreground hover:border-brand/50",
            !canMarkDone && "hover:border-border cursor-not-allowed opacity-40",
          )}>
          {toggle.isPending ? (
            <Loader2 className='size-3.5 animate-spin' aria-hidden />
          ) : (
            <Check className='size-3.5' aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
