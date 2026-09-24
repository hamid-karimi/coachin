import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FOOD_UNIT_OPTIONS, isFoodUnit, toGrams } from "./food-units";

// Same golden vectors as the Go tests (apps/api/internal/domain/nutrition).
type Case = Record<string, unknown> & { fn: string; want: unknown };
const vectors: Case[] = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../testdata/golden/nutrition.json"), "utf8"),
).cases;

const RUN: Record<string, (c: Case) => unknown> = {
  toGrams: (c) => toGrams(c.qty as number, c.unit as string),
  isFoodUnit: (c) => isFoodUnit(c.unit as string),
  FOOD_UNIT_OPTIONS: () => FOOD_UNIT_OPTIONS,
};
const replayed = vectors.filter((c) => c.fn in RUN);

describe("food units (golden vectors shared with the Go API)", () => {
  it("replays every unit function", () => {
    expect(new Set(replayed.map((c) => c.fn))).toEqual(new Set(Object.keys(RUN)));
  });

  it.each(replayed.map((c, i) => [i, c] as const))("case %i", (_, c) => {
    expect(RUN[c.fn](c)).toEqual(c.want);
  });
});
