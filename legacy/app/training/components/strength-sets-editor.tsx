"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  parsePrescription,
  totalVolumeKg,
  volumeEquivalence,
  type LoggedExercise,
} from "@/lib/workout-sets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Form-side mirror of LoggedExercise — inputs stay strings until submit. */
export type EditableSet = { weight_kg: string; reps: string };
export type EditableExercise = { name: string; sets: EditableSet[] };

export type StrengthSetsAction =
  | { type: "add_exercise" }
  | { type: "remove_exercise"; exercise: number }
  | { type: "rename_exercise"; exercise: number; name: string }
  | { type: "add_set"; exercise: number }
  | { type: "remove_set"; exercise: number; set: number }
  | {
      type: "update_set";
      exercise: number;
      set: number;
      field: keyof EditableSet;
      value: string;
    };

const MAX_EXERCISES = 20;
const MAX_SETS = 10;

const EMPTY_SET: EditableSet = { weight_kg: "", reps: "" };
const EMPTY_EXERCISE: EditableExercise = { name: "", sets: [{ ...EMPTY_SET }] };

export function strengthSetsReducer(
  state: EditableExercise[],
  action: StrengthSetsAction,
): EditableExercise[] {
  switch (action.type) {
    case "add_exercise":
      return state.length >= MAX_EXERCISES
        ? state
        : [...state, structuredClone(EMPTY_EXERCISE)];
    case "remove_exercise":
      return state.length === 1
        ? state
        : state.filter((_, index) => index !== action.exercise);
    case "rename_exercise":
      return state.map((exercise, index) =>
        index === action.exercise
          ? { ...exercise, name: action.name }
          : exercise,
      );
    case "add_set":
      return state.map((exercise, index) =>
        index === action.exercise && exercise.sets.length < MAX_SETS
          ? { ...exercise, sets: [...exercise.sets, { ...EMPTY_SET }] }
          : exercise,
      );
    case "remove_set":
      return state.map((exercise, index) =>
        index === action.exercise && exercise.sets.length > 1
          ? {
              ...exercise,
              sets: exercise.sets.filter((_, setIndex) => setIndex !== action.set),
            }
          : exercise,
      );
    case "update_set":
      return state.map((exercise, index) =>
        index === action.exercise
          ? {
              ...exercise,
              sets: exercise.sets.map((set, setIndex) =>
                setIndex === action.set
                  ? { ...set, [action.field]: action.value }
                  : set,
              ),
            }
          : exercise,
      );
  }
}

/** Prefill from the plan prescription ("DB Goblet Squat 3x10-12 + …"):
 *  one exercise per parsed entry, its sets ready with target reps and blank
 *  weights. Falls back to a single blank exercise. */
export function buildEditableExercises(
  prescription: string,
): EditableExercise[] {
  const parsed = parsePrescription(prescription);
  if (parsed.length === 0) return [structuredClone(EMPTY_EXERCISE)];
  return parsed.map((exercise) => ({
    name: exercise.name,
    sets: Array.from({ length: exercise.sets }, () => ({
      weight_kg: "",
      reps: String(exercise.repsLow),
    })),
  }));
}

/** Editable rows → the logged payload shape; unfilled rows drop out. */
export function toLoggedExercises(
  exercises: EditableExercise[],
): LoggedExercise[] {
  return exercises
    .map((exercise) => ({
      name: exercise.name.trim(),
      sets: exercise.sets
        .filter((set) => set.reps.trim() !== "")
        .map((set) => ({
          weight_kg: Number(set.weight_kg) || 0,
          reps: Number(set.reps),
        })),
    }))
    .filter((exercise) => exercise.name !== "" && exercise.sets.length > 0);
}

interface StrengthSetsEditorProps {
  exercises: EditableExercise[];
  dispatch: (action: StrengthSetsAction) => void;
}

/** Hevy-style per-set editor: exercise name + one weight×reps row per set,
 *  with a live total-volume line. Purely controlled — state lives in the
 *  log sheet's reducer. */
export function StrengthSetsEditor({
  exercises,
  dispatch,
}: StrengthSetsEditorProps) {
  const volume = totalVolumeKg(toLoggedExercises(exercises));
  const equivalence = volumeEquivalence(volume);

  return (
    <div className="space-y-3">
      <Label>Exercises (optional)</Label>
      {exercises.map((exercise, exerciseIndex) => (
        <div
          key={exerciseIndex}
          className="border-border space-y-2 rounded-lg border p-2.5"
        >
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Exercise ${exerciseIndex + 1} name`}
              maxLength={80}
              placeholder="Bulgarian split squat"
              value={exercise.name}
              onChange={(event) =>
                dispatch({
                  type: "rename_exercise",
                  exercise: exerciseIndex,
                  name: event.target.value,
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove exercise ${exerciseIndex + 1}`}
              disabled={exercises.length === 1}
              onClick={() =>
                dispatch({ type: "remove_exercise", exercise: exerciseIndex })
              }
            >
              <Trash2 aria-hidden />
            </Button>
          </div>

          <div className="space-y-1.5">
            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="flex items-center gap-2">
                <span className="text-muted-foreground w-10 shrink-0 text-xs">
                  Set {setIndex + 1}
                </span>
                <Input
                  aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} weight (kg)`}
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder="kg"
                  value={set.weight_kg}
                  onChange={(event) =>
                    dispatch({
                      type: "update_set",
                      exercise: exerciseIndex,
                      set: setIndex,
                      field: "weight_kg",
                      value: event.target.value,
                    })
                  }
                />
                <span className="text-muted-foreground text-xs">×</span>
                <Input
                  aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} reps`}
                  type="number"
                  min={0}
                  step="1"
                  placeholder="reps"
                  value={set.reps}
                  onChange={(event) =>
                    dispatch({
                      type: "update_set",
                      exercise: exerciseIndex,
                      set: setIndex,
                      field: "reps",
                      value: event.target.value,
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove exercise ${exerciseIndex + 1} set ${setIndex + 1}`}
                  disabled={exercise.sets.length === 1}
                  onClick={() =>
                    dispatch({
                      type: "remove_set",
                      exercise: exerciseIndex,
                      set: setIndex,
                    })
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={exercise.sets.length >= MAX_SETS}
              onClick={() =>
                dispatch({ type: "add_set", exercise: exerciseIndex })
              }
            >
              <Plus aria-hidden />
              Add set
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={exercises.length >= MAX_EXERCISES}
        onClick={() => dispatch({ type: "add_exercise" })}
      >
        <Plus aria-hidden />
        Add exercise
      </Button>

      {volume > 0 && (
        <p aria-live="polite" className="text-foreground text-xs font-medium">
          Total volume: {volume.toLocaleString("en-US")} kg
          {equivalence && (
            <span className="text-muted-foreground font-normal">
              {" "}
              — that&apos;s {equivalence.label} {equivalence.emoji}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
