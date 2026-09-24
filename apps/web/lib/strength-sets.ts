import { parsePrescription, type LoggedExercise } from "./workout-sets";

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

export const MAX_EXERCISES = 20;
export const MAX_SETS = 10;

const emptySet = (): EditableSet => ({ weight_kg: "", reps: "" });
const emptyExercise = (): EditableExercise => ({
  name: "",
  sets: [emptySet()],
});

type Handler<T extends StrengthSetsAction["type"]> = (
  state: EditableExercise[],
  action: Extract<StrengthSetsAction, { type: T }>,
) => EditableExercise[];

/** Applies fn to one exercise, leaving the others untouched. */
function updateExercise(
  state: EditableExercise[],
  index: number,
  fn: (exercise: EditableExercise) => EditableExercise,
): EditableExercise[] {
  return state.map((exercise, i) => (i === index ? fn(exercise) : exercise));
}

const HANDLERS: { [T in StrengthSetsAction["type"]]: Handler<T> } = {
  add_exercise: (state) => (state.length >= MAX_EXERCISES ? state : [...state, emptyExercise()]),
  remove_exercise: (state, { exercise }) => (state.length === 1 ? state : state.filter((_, i) => i !== exercise)),
  rename_exercise: (state, { exercise, name }) => updateExercise(state, exercise, (e) => ({ ...e, name })),
  add_set: (state, { exercise }) =>
    updateExercise(state, exercise, (e) => (e.sets.length >= MAX_SETS ? e : { ...e, sets: [...e.sets, emptySet()] })),
  remove_set: (state, { exercise, set }) =>
    updateExercise(state, exercise, (e) =>
      e.sets.length === 1 ? e : { ...e, sets: e.sets.filter((_, i) => i !== set) },
    ),
  update_set: (state, { exercise, set, field, value }) =>
    updateExercise(state, exercise, (e) => ({
      ...e,
      sets: e.sets.map((s, i) => (i === set ? { ...s, [field]: value } : s)),
    })),
};

/** The strength log editor's reducer: at most 20 exercises × 10 sets, never fewer than one of each. */
export function strengthSetsReducer(state: EditableExercise[], action: StrengthSetsAction): EditableExercise[] {
  return (HANDLERS[action.type] as Handler<typeof action.type>)(state, action as never);
}

/**
 * Prefill from the plan prescription ("DB Goblet Squat 3x10-12 + …"): one
 * exercise per parsed entry, its sets ready with the target reps and blank
 * weights. Falls back to a single blank exercise.
 */
export function buildEditableExercises(prescription: string): EditableExercise[] {
  const parsed = parsePrescription(prescription);
  if (parsed.length === 0) return [emptyExercise()];
  return parsed.map((exercise) => ({
    name: exercise.name,
    sets: Array.from({ length: exercise.sets }, () => ({
      weight_kg: "",
      reps: String(exercise.repsLow),
    })),
  }));
}

/** Editable rows → the logged payload; unfilled rows drop out. */
export function toLoggedExercises(exercises: EditableExercise[]): LoggedExercise[] {
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
