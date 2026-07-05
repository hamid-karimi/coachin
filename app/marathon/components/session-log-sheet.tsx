"use client";

import { useActionState, useState } from "react";
import { Loader2, NotebookPen, Plus, Save, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logSessionAction, type MarathonActionState } from "../actions";

const initialState: MarathonActionState = {};

const textareaClassName =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]";

type ExerciseRow = {
  name: string;
  sets: string;
  reps: string;
  weight_kg: string;
};

const EMPTY_EXERCISE: ExerciseRow = { name: "", sets: "", reps: "", weight_kg: "" };

const MAX_EXERCISES = 20;

function serializeExercises(rows: ExerciseRow[]): string {
  return JSON.stringify(
    rows
      .filter((row) => row.name.trim() !== "")
      .map((row) => ({
        name: row.name.trim(),
        sets: Number(row.sets),
        reps: Number(row.reps),
        ...(row.weight_kg.trim() !== ""
          ? { weight_kg: Number(row.weight_kg) }
          : {}),
      })),
  );
}

interface SessionLogSheetProps {
  itemId: string;
  /** Only 'run' and 'strength' items are loggable. */
  itemType: string;
  itemTitle: string;
}

/** Optional post-completion session log ("How did it go?" — skippable).
 *  Everything beyond the plan item is optional. */
export function SessionLogSheet({
  itemId,
  itemType,
  itemTitle,
}: SessionLogSheetProps) {
  const [open, setOpen] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [exercises, setExercises] = useState<ExerciseRow[]>([
    { ...EMPTY_EXERCISE },
  ]);
  const [state, formAction, pending] = useActionState(
    logSessionAction,
    initialState,
  );
  useActionToast(state);

  if (state.success) {
    return (
      <p className="text-muted-foreground pl-11 text-xs">
        Session logged — nice work.
      </p>
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

  const updateExercise = (
    index: number,
    field: keyof ExerciseRow,
    value: string,
  ) => {
    setExercises((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row,
      ),
    );
  };

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
        <div className="space-y-2">
          <Label>Exercises (optional)</Label>
          <input
            type="hidden"
            name="exercises_json"
            value={serializeExercises(exercises)}
          />
          {exercises.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                {index === 0 && (
                  <span className="text-muted-foreground text-[11px]">
                    Exercise
                  </span>
                )}
                <Input
                  aria-label={`Exercise ${index + 1} name`}
                  maxLength={80}
                  placeholder="Bulgarian split squat"
                  value={row.name}
                  onChange={(event) =>
                    updateExercise(index, "name", event.target.value)
                  }
                />
              </div>
              {(
                [
                  ["sets", "Sets", "3"],
                  ["reps", "Reps", "10"],
                  ["weight_kg", "kg", "20"],
                ] as const
              ).map(([field, label, placeholder]) => (
                <div key={field} className="w-14 space-y-1">
                  {index === 0 && (
                    <span className="text-muted-foreground text-[11px]">
                      {label}
                    </span>
                  )}
                  <Input
                    aria-label={`Exercise ${index + 1} ${label}`}
                    type="number"
                    min={0}
                    step={field === "weight_kg" ? "0.5" : "1"}
                    placeholder={placeholder}
                    value={row[field]}
                    onChange={(event) =>
                      updateExercise(index, field, event.target.value)
                    }
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove exercise ${index + 1}`}
                disabled={exercises.length === 1}
                onClick={() =>
                  setExercises((current) =>
                    current.filter((_, rowIndex) => rowIndex !== index),
                  )
                }
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={exercises.length >= MAX_EXERCISES}
            onClick={() =>
              setExercises((current) => [...current, { ...EMPTY_EXERCISE }])
            }
          >
            <Plus aria-hidden />
            Add exercise
          </Button>
        </div>
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
