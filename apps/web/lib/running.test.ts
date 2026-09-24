import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clampBaseWeeks,
  formatSeconds,
  parseTimeToSeconds,
  raceDistanceKm,
  riegelSeconds,
  suggestGoalForDistance,
  type RaceTarget,
} from "./running";

// The API owns this math (apps/api/internal/domain/running); the wizard keeps
// a copy for instant goal suggestions. Replaying the same golden vectors as
// the Go tests keeps the two identical.
type Case = Record<string, unknown> & { fn: string; want: unknown };
const vectors: Case[] = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../testdata/golden/running.json"), "utf8"),
).cases;

const RUN: Record<string, (c: Case) => unknown> = {
  riegelSeconds: (c) => riegelSeconds(c.d1 as number, c.t1 as number, c.d2 as number),
  parseTimeToSeconds: (c) => parseTimeToSeconds(c.value as string),
  formatSeconds: (c) => formatSeconds(c.seconds as number),
  raceDistanceKm: (c) => raceDistanceKm(c.target as RaceTarget, c.customKm as number | null),
  clampBaseWeeks: (c) => clampBaseWeeks(c.value as never),
  suggestGoalForDistance: (c) => suggestGoalForDistance(c.pbs as never, c.targetKm as number),
};

describe("running (golden vectors shared with the Go API)", () => {
  it("covers every function", () => {
    expect(new Set(vectors.map((c) => c.fn))).toEqual(new Set(Object.keys(RUN)));
  });

  it.each(vectors.map((c, i) => [i, c] as const))("case %i", (_, c) => {
    expect(RUN[c.fn](c)).toEqual(c.want);
  });
});
