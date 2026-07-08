"use client";

import { useActionState, useReducer, useState } from "react";
import { Loader2, NotebookPen, Save } from "lucide-react";

import { cn } from "@/lib/utils";
import { volumeEquivalence } from "@/lib/workout-sets";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { useConfettiBurst } from "@/components/hooks/use-confetti-burst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  StrengthSetsEditor,
  buildEditableExercises,
  strengthSetsReducer,
  toLoggedExercises,
} from "./strength-sets-editor";
import { logSessionAction, type TrainingActionState } from "../actions";

const initialState: TrainingActionState = {};

const textareaClassName =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]";

interface SessionLogSheetProps {
  itemId: string;
  /** Only 'run' and 'strength' items are loggable. */
  itemType: string;
  itemTitle: string;
  /** Full session prescription — prefills the per-set strength editor. */
  itemDescription?: string | null;
}

/** Optional post-completion session log ("How did it go?" — skippable).
 *  Everything beyond the plan item is optional. */
export function SessionLogSheet({
  itemId,
  itemType,
  itemTitle,
  itemDescription,
}: SessionLogSheetProps) {
  const [open, setOpen] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [exercises, dispatch] = useReducer(
    strengthSetsReducer,
    itemDescription ?? itemTitle,
    buildEditableExercises,
  );
  const [state, formAction, pending] = useActionState(
    logSessionAction,
    initialState,
  );
  useActionToast(state);
  const totalVolume = state.totalVolumeKg ?? 0;
  useConfettiBurst(Boolean(state.success) && totalVolume > 0);

  if (state.success) {
    const equivalence = volumeEquivalence(totalVolume);
    return (
      <div className="space-y-1 pl-11">
        <p className="text-muted-foreground text-xs">
          Session logged — nice work.
        </p>
        {totalVolume > 0 && (
          <p className="text-foreground text-xs font-medium">
            You lifted {totalVolume.toLocaleString("en-US")} kg total
            {equivalence && ` — that's ${equivalence.label} ${equivalence.emoji}`}
          </p>
        )}
        {state.feedback && (
          <p
            className={cn(
              "text-xs",
              state.feedback.flag === "red"
                ? "text-destructive"
                : state.feedback.flag === "caution"
                  ? "text-flame-ink"
                  : "text-muted-foreground",
            )}
          >
            {state.feedback.message}
          </p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <div className="pl-11">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <NotebookPen aria-hidden />
          Log details
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="bg-card border-border ml-11 space-y-3 rounded-xl border p-4"
    >
      <input type="hidden" name="plan_item_id" value={itemId} />
      <input type="hidden" name="sport" value={itemType} />

      <p className="text-foreground text-sm font-semibold">
        How did it go? <span className="text-muted-foreground font-normal">— {itemTitle}</span>
      </p>

      {/* RPE 1-10 (optional) */}
      <div className="space-y-1.5">
        <Label>Effort (RPE, optional)</Label>
        <input type="hidden" name="rpe" value={rpe ?? ""} />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={rpe === value}
              onClick={() =>
                setRpe((current) => (current === value ? null : value))
              }
              className={cn(
                "grid size-7 place-items-center rounded-md border text-xs font-medium transition-colors",
                rpe === value
                  ? "bg-brand border-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:border-brand/50",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {/* Sport-shaped fields (all optional) */}
      {itemType === "run" ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`distance-${itemId}`}>Distance (km)</Label>
            <Input
              id={`distance-${itemId}`}
              name="distance_km"
              type="number"
              min={0}
              step="0.1"
              placeholder="10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`duration-${itemId}`}>Duration (min)</Label>
            <Input
              id={`duration-${itemId}`}
              name="duration_min"
              type="number"
              min={0}
              step="1"
              placeholder="55"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`avg-hr-${itemId}`}>Avg HR</Label>
            <Input
              id={`avg-hr-${itemId}`}
              name="avg_hr"
              type="number"
              min={0}
              step="1"
              placeholder="150"
            />
          </div>
        </div>
      ) : (
        <>
          <input
            type="hidden"
            name="exercises_json"
            value={JSON.stringify(toLoggedExercises(exercises))}
          />
          <StrengthSetsEditor exercises={exercises} dispatch={dispatch} />
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={`note-${itemId}`}>Note (optional)</Label>
        <textarea
          id={`note-${itemId}`}
          name="note"
          rows={2}
          maxLength={500}
          placeholder="How did it feel? Any pain?"
          className={textareaClassName}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Skip
        </Button>
        <Button type="submit" variant="brand" size="sm" disabled={pending}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Save aria-hidden />
          )}
          Save log
        </Button>
      </div>
    </form>
  );
}
