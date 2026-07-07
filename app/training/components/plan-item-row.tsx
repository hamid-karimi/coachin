"use client";

import { useActionState } from "react";
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

import { cn } from "@/lib/utils";
import { planItemDetailLine, planItemVideoUrl } from "@/lib/plan-items";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { togglePlanItemAction, type TrainingActionState } from "../actions";
import { SessionLogSheet } from "./session-log-sheet";

const initialState: TrainingActionState = {};

const LOGGABLE_TYPES = new Set(["run", "strength"]);

const TYPE_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  run: { icon: Footprints, tone: "bg-brand-tint text-brand-ink" },
  strength: { icon: Dumbbell, tone: "bg-secondary text-foreground" },
  stretch: { icon: Activity, tone: "bg-xp-tint text-xp-ink" },
  mobility: { icon: PersonStanding, tone: "bg-xp-tint text-xp-ink" },
  recovery: { icon: BedDouble, tone: "bg-secondary text-muted-foreground" },
  // Active recovery (a light walk etc.) reads better as footsteps than a bed.
  recovery_active: {
    icon: Footprints,
    tone: "bg-secondary text-muted-foreground",
  },
  meal_note: { icon: UtensilsCrossed, tone: "bg-flame-tint text-flame-ink" },
};

const RECOVERY_WALK = /walk|jog|hike|stroll|spin|swim|bike|cycle/i;

function metaKeyFor(item: PlanItem): string {
  if (item.item_type === "recovery" && RECOVERY_WALK.test(item.title)) {
    return "recovery_active";
  }
  return item.item_type;
}

export type PlanItem = {
  id: string;
  week: number;
  day_of_week: number;
  item_type: string;
  title: string;
  details: {
    distance_km?: number;
    pace_min_km?: string;
    duration_min?: number;
    notes?: string;
    video_query?: string;
  } | null;
  is_completed: boolean;
};

/** True when today is the item's day or the day after (the log window). */
function withinLogWindow(date: string | undefined): boolean {
  if (!date) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const itemDay = new Date(`${date}T00:00:00`);
  const dayAfter = new Date(itemDay);
  dayAfter.setDate(itemDay.getDate() + 1);
  return today >= itemDay && today <= dayAfter;
}

export function PlanItemRow({
  item,
  date,
}: {
  item: PlanItem;
  /** The item's calendar date (YYYY-MM-DD), for gating the "done" toggle. */
  date?: string;
}) {
  const [state, formAction, pending] = useActionState(
    togglePlanItemAction,
    initialState,
  );
  useActionToast(state);

  const meta = TYPE_META[metaKeyFor(item)] ?? TYPE_META.recovery;
  const Icon = meta.icon;
  // You can only tick something done on its day or the day after; undoing a
  // completed item is always allowed so mistakes are fixable.
  const canMarkDone = item.is_completed || withinLogWindow(date);
  const opensLabel =
    !canMarkDone && date
      ? `Opens ${new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}`
      : undefined;
  const detailLine = planItemDetailLine(item.details);
  const videoUrl = planItemVideoUrl(item.details);

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "border-border flex items-start gap-3 rounded-xl border p-3",
          item.is_completed && "opacity-70",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            meta.tone,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-sm font-medium",
              item.is_completed && "line-through",
            )}
          >
            {item.title}
          </p>
          {detailLine && (
            <p className="text-muted-foreground text-xs">{detailLine}</p>
          )}
          {item.details?.notes && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.details.notes}
            </p>
          )}
          {videoUrl && (
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-ink mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              <Play className="size-3" aria-hidden />
              Watch how
            </a>
          )}
        </div>
        {item.item_type !== "meal_note" && (
          <form action={formAction}>
            <input type="hidden" name="item_id" value={item.id} />
            <input
              type="hidden"
              name="completed"
              value={item.is_completed ? "false" : "true"}
            />
            <button
              type="submit"
              disabled={pending || !canMarkDone}
              title={opensLabel}
              aria-label={
                item.is_completed
                  ? "Mark as not done"
                  : (opensLabel ?? "Mark as done")
              }
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                item.is_completed
                  ? "bg-brand border-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:border-brand/50",
                !canMarkDone && "cursor-not-allowed opacity-40 hover:border-border",
              )}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <Check className="size-3.5" aria-hidden />
              )}
            </button>
          </form>
        )}
      </div>
      {LOGGABLE_TYPES.has(item.item_type) && item.is_completed && (
        <SessionLogSheet
          itemId={item.id}
          itemType={item.item_type}
          itemTitle={item.title}
        />
      )}
    </div>
  );
}
