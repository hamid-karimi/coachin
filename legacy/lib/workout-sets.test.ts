import { describe, expect, it } from "vitest";

import {
  normalizeLoggedExercises,
  parsePrescription,
  totalVolumeKg,
  volumeEquivalence,
} from "./workout-sets";

describe("totalVolumeKg", () => {
  it("sums weight × reps across exercises and sets", () => {
    expect(
      totalVolumeKg([
        {
          name: "Goblet squat",
          sets: [
            { weight_kg: 20, reps: 10 },
            { weight_kg: 22.5, reps: 8 },
          ],
        },
        { name: "Floor press", sets: [{ weight_kg: 15, reps: 12 }] },
      ]),
    ).toBe(20 * 10 + 22.5 * 8 + 15 * 12);
  });

  it("counts bodyweight (0 kg) sets as zero volume", () => {
    expect(
      totalVolumeKg([{ name: "Push-up", sets: [{ weight_kg: 0, reps: 20 }] }]),
    ).toBe(0);
  });

  it("ignores non-finite and negative values", () => {
    expect(
      totalVolumeKg([
        {
          name: "Broken",
          sets: [
            { weight_kg: Number.NaN, reps: 10 },
            { weight_kg: -5, reps: 10 },
            { weight_kg: 10, reps: Number.POSITIVE_INFINITY },
            { weight_kg: 10, reps: 5 },
          ],
        },
      ]),
    ).toBe(50);
  });

  it("rounds to one decimal", () => {
    expect(
      totalVolumeKg([{ name: "A", sets: [{ weight_kg: 1.11, reps: 3 }] }]),
    ).toBe(3.3);
  });
});

describe("volumeEquivalence", () => {
  it("picks the largest threshold cleared", () => {
    expect(volumeEquivalence(4200)?.label).toBe("an adult elephant");
    expect(volumeEquivalence(1540)?.label).toBe("a small car");
    expect(volumeEquivalence(700)?.label).toBe("a grand piano");
    expect(volumeEquivalence(399)?.label).toBe("a refrigerator");
    expect(volumeEquivalence(80)?.label).toBe("a washing machine");
  });

  it("returns null below the smallest threshold and for junk", () => {
    expect(volumeEquivalence(79)).toBeNull();
    expect(volumeEquivalence(0)).toBeNull();
    expect(volumeEquivalence(Number.NaN)).toBeNull();
  });
});

describe("parsePrescription", () => {
  it("parses a real multi-exercise prescription", () => {
    const parsed = parsePrescription(
      "DB Goblet Squat 3x10-12 + DB Floor Press 3x10-12 + Resistance Band Pull-Apart 3x15-20",
    );
    expect(parsed).toEqual([
      { name: "DB Goblet Squat", sets: 3, repsLow: 10, repsHigh: 12 },
      { name: "DB Floor Press", sets: 3, repsLow: 10, repsHigh: 12 },
      { name: "Resistance Band Pull-Apart", sets: 3, repsLow: 15, repsHigh: 20 },
    ]);
  });

  it("drops trailing qualifiers after the set pattern (per leg)", () => {
    expect(parsePrescription("DB Reverse Lunges 3x10-12 (per leg)")).toEqual([
      { name: "DB Reverse Lunges", sets: 3, repsLow: 10, repsHigh: 12 },
    ]);
  });

  it("handles single rep counts without a range", () => {
    expect(parsePrescription("Deadlift 5x5")).toEqual([
      { name: "Deadlift", sets: 5, repsLow: 5, repsHigh: null },
    ]);
  });

  it("splits newline-separated descriptions", () => {
    expect(parsePrescription("Bench press 3x8\nBarbell row 3x8-10")).toEqual([
      { name: "Bench press", sets: 3, repsLow: 8, repsHigh: null },
      { name: "Barbell row", sets: 3, repsLow: 8, repsHigh: 10 },
    ]);
  });

  it("skips segments without a pattern or name and caps set counts", () => {
    expect(parsePrescription("Warm up thoroughly + 3x10 + Squat 99x10")).toEqual(
      [{ name: "Squat", sets: 10, repsLow: 10, repsHigh: null }],
    );
  });

  it("returns [] for empty or unparseable text", () => {
    expect(parsePrescription("")).toEqual([]);
    expect(parsePrescription("Easy run 5k with drills")).toEqual([]);
  });
});

describe("normalizeLoggedExercises", () => {
  it("passes through the new per-set shape, dropping invalid sets", () => {
    expect(
      normalizeLoggedExercises([
        {
          name: "Goblet squat",
          sets: [
            { weight_kg: 20, reps: 10 },
            { weight_kg: "junk", reps: 8 },
            { weight_kg: 20, reps: 0 },
          ],
        },
      ]),
    ).toEqual([
      {
        name: "Goblet squat",
        sets: [
          { weight_kg: 20, reps: 10 },
          { weight_kg: 0, reps: 8 },
        ],
      },
    ]);
  });

  it("expands the legacy flat shape into identical set entries", () => {
    expect(
      normalizeLoggedExercises([
        { name: "Bench press", sets: 3, reps: 10, weight_kg: 40 },
      ]),
    ).toEqual([
      {
        name: "Bench press",
        sets: [
          { weight_kg: 40, reps: 10 },
          { weight_kg: 40, reps: 10 },
          { weight_kg: 40, reps: 10 },
        ],
      },
    ]);
  });

  it("expands legacy rows without weight as 0 kg sets", () => {
    expect(
      normalizeLoggedExercises([{ name: "Push-up", sets: 2, reps: 15 }]),
    ).toEqual([
      {
        name: "Push-up",
        sets: [
          { weight_kg: 0, reps: 15 },
          { weight_kg: 0, reps: 15 },
        ],
      },
    ]);
  });

  it("drops nameless, empty, and non-object entries; never throws", () => {
    expect(
      normalizeLoggedExercises([
        null,
        42,
        { sets: 3, reps: 10 },
        { name: "  ", sets: 3, reps: 10 },
        { name: "No sets", sets: [] },
      ]),
    ).toEqual([]);
    expect(normalizeLoggedExercises("garbage")).toEqual([]);
    expect(normalizeLoggedExercises(undefined)).toEqual([]);
  });
});
