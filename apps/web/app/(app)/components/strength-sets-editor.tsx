import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_EXERCISES,
  MAX_SETS,
  toLoggedExercises,
  type EditableExercise,
  type EditableSet,
  type StrengthSetsAction,
} from "@/lib/strength-sets";
import { equivalenceSuffix, formatKg, totalVolumeKg } from "@/lib/workout-sets";

interface StrengthSetsEditorProps {
  exercises: EditableExercise[];
  dispatch: (action: StrengthSetsAction) => void;
}

const SET_FIELDS: {
  field: keyof EditableSet;
  label: string;
  step: string;
  placeholder: string;
}[] = [
  { field: "weight_kg", label: "weight (kg)", step: "0.5", placeholder: "kg" },
  { field: "reps", label: "reps", step: "1", placeholder: "reps" },
];

/**
 * Per-set editor: exercise name + one weight × reps row per set, with a live
 * total-volume line. Controlled — state lives in the log sheet's reducer.
 */
export function StrengthSetsEditor({ exercises, dispatch }: StrengthSetsEditorProps) {
  const volume = totalVolumeKg(toLoggedExercises(exercises));

  return (
    <div className='space-y-3'>
      <Label>Exercises (optional)</Label>
      {exercises.map((exercise, e) => (
        <div key={e} className='border-border space-y-2 rounded-lg border p-2.5'>
          <div className='flex items-center gap-2'>
            <Input
              aria-label={`Exercise ${e + 1} name`}
              maxLength={80}
              placeholder='Bulgarian split squat'
              value={exercise.name}
              onChange={(ev) =>
                dispatch({
                  type: "rename_exercise",
                  exercise: e,
                  name: ev.target.value,
                })
              }
            />
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label={`Remove exercise ${e + 1}`}
              disabled={exercises.length === 1}
              onClick={() => dispatch({ type: "remove_exercise", exercise: e })}>
              <Trash2 aria-hidden />
            </Button>
          </div>
          <div className='space-y-1.5'>
            {exercise.sets.map((set, s) => (
              <div key={s} className='flex items-center gap-2'>
                <span className='text-muted-foreground w-10 shrink-0 text-xs'>Set {s + 1}</span>
                {SET_FIELDS.map(({ field, label, step, placeholder }, i) => (
                  <div key={field} className='contents'>
                    {i > 0 && <span className='text-muted-foreground text-xs'>×</span>}
                    <Input
                      aria-label={`Exercise ${e + 1} set ${s + 1} ${label}`}
                      type='number'
                      inputMode='decimal'
                      min={0}
                      step={step}
                      placeholder={placeholder}
                      value={set[field]}
                      onChange={(ev) =>
                        dispatch({
                          type: "update_set",
                          exercise: e,
                          set: s,
                          field,
                          value: ev.target.value,
                        })
                      }
                    />
                  </div>
                ))}
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label={`Remove exercise ${e + 1} set ${s + 1}`}
                  disabled={exercise.sets.length === 1}
                  onClick={() => dispatch({ type: "remove_set", exercise: e, set: s })}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={exercise.sets.length >= MAX_SETS}
              onClick={() => dispatch({ type: "add_set", exercise: e })}>
              <Plus aria-hidden />
              Add set
            </Button>
          </div>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={exercises.length >= MAX_EXERCISES}
        onClick={() => dispatch({ type: "add_exercise" })}>
        <Plus aria-hidden />
        Add exercise
      </Button>
      {volume > 0 && (
        <p aria-live='polite' className='text-foreground text-xs font-medium'>
          Total volume: {formatKg(volume)} kg
          <span className='text-muted-foreground font-normal'>{equivalenceSuffix(volume)}</span>
        </p>
      )}
    </div>
  );
}
