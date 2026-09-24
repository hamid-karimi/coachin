"use client";

import type { ReactNode } from "react";
import { Play } from "lucide-react";

import { BottomSheet } from "@/components/design-system/bottom-sheet";
import {
  planItemDetailLine,
  planItemTypeLabel,
  planItemVideoUrl,
} from "@/lib/plan-items";
import { weekDayOf } from "@/lib/week-days";
import { PlanTypeIcon } from "./PlanTypeIcon";
import type { PlanWeekItem } from "../actions";

interface DetailRowProps {
  label: string;
  value: string;
  icon?: ReactNode;
}

function DetailRow({ label, value, icon }: DetailRowProps) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-foreground inline-flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {value}
      </dd>
    </div>
  );
}

/**
 * Read-only detail sheet for an AI plan session: the full session breakdown —
 * stat line (distance / pace / duration), description, type, day, and the
 * how-to video link. Renders as a bottom sheet on mobile and a centered dialog
 * on desktop. Open when `item` is non-null. The plan is edited in /training.
 */
export function PlanSessionSheet({
  item,
  onClose,
}: {
  item: PlanWeekItem | null;
  onClose: () => void;
}) {
  const detailLine = item ? planItemDetailLine(item.details) : "";
  const videoUrl = item ? planItemVideoUrl(item.details) : null;

  return (
    <BottomSheet
      open={item !== null}
      onClose={onClose}
      title={item?.title ?? ""}
      description="From your AI plan · edit it in Training"
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
            <DetailRow
              label="Type"
              value={planItemTypeLabel(item.item_type)}
              icon={
                <PlanTypeIcon
                  type={item.item_type}
                  className="text-muted-foreground size-4"
                />
              }
            />
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
