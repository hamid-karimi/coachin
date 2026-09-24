import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parsePrescription,
  totalVolumeKg,
  volumeEquivalence,
  equivalenceSuffix,
  formatKg,
  type LoggedExercise,
} from "./workout-sets";

// Same golden vectors as the Go tests (apps/api/internal/domain/workout);
// normalizing logged payloads stays server-side.
type Case = Record<string, unknown> & { fn: string; want: unknown };
const vectors: Case[] = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../testdata/golden/workout-sets.json"), "utf8"),
).cases;

const RUN: Record<string, (c: Case) => unknown> = {
  totalVolumeKg: (c) => totalVolumeKg(c.exercises as LoggedExercise[]),
  volumeEquivalence: (c) => volumeEquivalence(c.kg as number),
  parsePrescription: (c) => parsePrescription(c.text as string),
};
const replayed = vectors.filter((c) => c.fn in RUN);

describe("workout sets (golden vectors shared with the Go API)", () => {
  it("replays every client-side function", () => {
    expect(new Set(replayed.map((c) => c.fn))).toEqual(new Set(Object.keys(RUN)));
  });

  it.each(replayed.map((c, i) => [i, c] as const))("case %i", (_, c) => {
    expect(RUN[c.fn](c)).toEqual(c.want);
  });
});

describe("volume display", () => {
  it("groups thousands and compares when heavy enough", () => {
    expect(formatKg(1250.5)).toBe("1,250.5");
    expect(equivalenceSuffix(1250)).toBe(" — that's a grand piano 🎹");
    expect(equivalenceSuffix(50)).toBe("");
  });
});
