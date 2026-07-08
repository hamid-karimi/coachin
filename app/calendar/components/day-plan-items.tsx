"use client";

import { useState } from "react";
import {
  BedDouble,
  ChevronRight,
  Dumbbell,
  Footprints,
  Play,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  planItemDetailLine,
  planItemTypeLabel,
  planItemVideoUrl,
  type PlanItemDetails,
} from "@/lib/plan-items";
import { weekDayOf } from "@/lib/week-days";
import { BottomSheet } from "@/components/design-system/bottom-sheet";

const PLAN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  run: Footprints,
  strength: Dumbbell,
  recovery: BedDouble,
};

export type CalendarPlanItem = {
  day_of_week: number;
  item_type: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  details: PlanItemDetails | null;
};

/**
 * Calendar plan items rendered as clickable rows that open a read-only detail
 * sheet (stat line, notes, type, day, how-to video) — the same detail pattern
 * as the onboarding week agenda. The plan itself is edited in Training.
 */
export function DayPlanItems({ items }: { items: CalendarPlanItem[] }) {
  const [selected, setSelected] = useState<CalendarPlanItem | null>(null);

  return (
    <>
      {items.map((item, index) => {
        const Icon = PLAN_ICON[item.item_type] ?? Sparkles;
        return (
          <button
            key={`p-${index}`}
            type="button"
            onClick={() => setSelected(item)}
            className="hover:bg-secondary flex w-full items-center gap-2.5 rounded-md p-1 -mx-1 text-left text-sm transition-colors"
          >
            <span className="bg-brand-tint text-brand-ink grid size-7 shrink-0 place-items-center rounded-lg">
              <Icon className="size-4" aria-hidden />
            </span>
            <span
              className={cn(
                "min-w-0 flex-1 truncate",
                item.is_completed && "text-muted-foreground line-through",
              )}
            >
              {item.title}
            </span>
            <ChevronRight
              className="text-muted-foreground/60 size-4 shrink-0"
              aria-hidden
            />
          </button>
        );
      })}

      <PlanDetailSheet item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground text-sm font-semibold">{value}</dd>
    </div>
  );
}

function PlanDetailSheet({
  item,
  onClose,
}: {
  item: CalendarPlanItem | null;
  onClose: () => void;
}) {
  const detailLine = item ? planItemDetailLine(item.details) : "";
  const videoUrl = item ? planItemVideoUrl(item.details) : null;

  return (
    <BottomSheet
      open={item !== null}
      onClose={onClose}
      title={item?.title ?? ""}
      description="From your training plan · edit it in Training"
    >
      {item && (
        <div className="flex flex-col gap-4">
          {detailLine && (
            <p className="text-foreground text-sm font-semibold">{detailLine}</p>
          )}

          {item.description && (
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {item.description}
            </p>
          )}

          {item.details?.notes && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {item.details.notes}
            </p>
          )}

          <dl className="flex flex-col">
            <DetailRow label="Type" value={planItemTypeLabel(item.item_type)} />
            <DetailRow
              label="Day"
              value={weekDayOf(item.day_of_week)?.name ?? "—"}
            />
          </dl>

          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-ink inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <Play className="size-3.5" aria-hidden />
              Watch how
            </a>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
