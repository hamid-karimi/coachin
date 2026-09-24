import { describe, expect, it } from "vitest";
import {
  MAX_EXERCISES,
  MAX_SETS,
  buildEditableExercises,
  strengthSetsReducer,
  toLoggedExercises,
  type EditableExercise,
} from "./strength-sets";

const one = (): EditableExercise[] => [{ name: "Squat", sets: [{ weight_kg: "100", reps: "5" }] }];

describe("strengthSetsReducer", () => {
  it("adds, renames, and removes exercises but keeps at least one", () => {
    let state = strengthSetsReducer(one(), { type: "add_exercise" });
    expect(state).toHaveLength(2);
    state = strengthSetsReducer(state, {
      type: "rename_exercise",
      exercise: 1,
      name: "Bench",
    });
    expect(state[1].name).toBe("Bench");
    state = strengthSetsReducer(state, {
      type: "remove_exercise",
      exercise: 0,
    });
    expect(state.map((e) => e.name)).toEqual(["Bench"]);
    expect(strengthSetsReducer(state, { type: "remove_exercise", exercise: 0 })).toBe(state);
  });

  it("caps exercises and sets", () => {
    const full = Array.from({ length: MAX_EXERCISES }, one).flat();
    expect(strengthSetsReducer(full, { type: "add_exercise" })).toBe(full);
    let state = one();
    for (let i = 0; i < MAX_SETS + 3; i++) state = strengthSetsReducer(state, { type: "add_set", exercise: 0 });
    expect(state[0].sets).toHaveLength(MAX_SETS);
  });

  it("updates and removes sets, never the last one", () => {
    let state = strengthSetsReducer(one(), { type: "add_set", exercise: 0 });
    state = strengthSetsReducer(state, {
      type: "update_set",
      exercise: 0,
      set: 1,
      field: "reps",
      value: "8",
    });
    expect(state[0].sets[1]).toEqual({ weight_kg: "", reps: "8" });
    state = strengthSetsReducer(state, {
      type: "remove_set",
      exercise: 0,
      set: 0,
    });
    expect(state[0].sets).toEqual([{ weight_kg: "", reps: "8" }]);
    expect(strengthSetsReducer(state, { type: "remove_set", exercise: 0, set: 0 })[0].sets).toHaveLength(1);
  });
});

describe("buildEditableExercises", () => {
  it("prefills sets with target reps from the prescription", () => {
    expect(buildEditableExercises("DB Goblet Squat 2x10-12 + Plank 1x30")).toEqual([
      {
        name: "DB Goblet Squat",
        sets: [
          { weight_kg: "", reps: "10" },
          { weight_kg: "", reps: "10" },
        ],
      },
      { name: "Plank", sets: [{ weight_kg: "", reps: "30" }] },
    ]);
  });

  it("falls back to one blank exercise", () => {
    expect(buildEditableExercises("Upper body A")).toEqual([{ name: "", sets: [{ weight_kg: "", reps: "" }] }]);
  });
});

describe("toLoggedExercises", () => {
  it("drops unnamed exercises and sets without reps; blank weight is bodyweight", () => {
    expect(
      toLoggedExercises([
        {
          name: " Squat ",
          sets: [
            { weight_kg: "100", reps: "5" },
            { weight_kg: "100", reps: " " },
          ],
        },
        { name: "Push-up", sets: [{ weight_kg: "", reps: "15" }] },
        { name: "", sets: [{ weight_kg: "20", reps: "10" }] },
        { name: "Lunge", sets: [{ weight_kg: "20", reps: "" }] },
      ]),
    ).toEqual([
      { name: "Squat", sets: [{ weight_kg: 100, reps: 5 }] },
      { name: "Push-up", sets: [{ weight_kg: 0, reps: 15 }] },
    ]);
  });
});
