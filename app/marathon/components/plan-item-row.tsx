"use client";

import { useActionState } from "react";
import {
  Activity,
  BedDouble,
  Check,
  Dumbbell,
  Footprints,
  Loader2,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { togglePlanItemAction, type MarathonActionState } from "../actions";
import { SessionLogSheet } from "./session-log-sheet";

const initialState: MarathonActionState = {};

const LOGGABLE_TYPES = new Set(["run", "strength"]);

const TYPE_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  run: { icon: Footprints, tone: "bg-brand-tint text-brand-ink" },
  strength: { icon: Dumbbell, tone: "bg-secondary text-foreground" },
  stretch: { icon: Activity, tone: "bg-xp-tint text-xp-ink" },
  recovery: { icon: BedDouble, tone: "bg-secondary text-muted-foreground" },
  meal_note: { icon: UtensilsCrossed, tone: "bg-flame-tint text-flame-ink" },
};

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
  } | null;
  is_completed: boolean;
};

export function PlanItemRow({ item }: { item: PlanItem }) {
  const [state, formAction, pending] = useActionState(
    togglePlanItemAction,
    initialState,
  );
  useActionToast(state);

  const meta = TYPE_META[item.item_type] ?? TYPE_META.recovery;
  const Icon = meta.icon;
  const detailBits = [
    item.details?.distance_km ? `${item.details.distance_km}km` : null,
    item.details?.pace_min_km ? `@ ${item.details.pace_min_km}/km` : null,
    item.details?.duration_min ? `${item.details.duration_min}min` : null,
  ].filter(Boolean);

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
          {detailBits.length > 0 && (
            <p className="text-muted-foreground text-xs">
              {detailBits.join(" · ")}
            </p>
          )}
          {item.details?.notes && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.details.notes}
            </p>
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
              disabled={pending}
              aria-label={
                item.is_completed ? "Mark as not done" : "Mark as done"
              }
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
                item.is_completed
                  ? "bg-brand border-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:border-brand/50",
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
