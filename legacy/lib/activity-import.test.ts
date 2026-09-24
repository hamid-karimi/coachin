import { describe, expect, it } from "vitest";

import {
  sanitizeActivities,
  splitImportableActivities,
} from "./activity-import";
import type { ActivitySummary } from "./activity-parse";

const run = (date: string): ActivitySummary => ({
  date,
  distance_km: 5,
  duration_min: 30,
  avg_pace_min_km: 6,
  avg_hr: null,
  source: "gpx",
});

describe("sanitizeActivities", () => {
  it("keeps valid entries and normalizes numbers", () => {
    expect(
      sanitizeActivities([
        { date: "2026-07-08", distance_km: 5.234, duration_min: 31.26, avg_hr: 151.4, source: "fit" },
      ]),
    ).toEqual([
      {
        date: "2026-07-08",
        distance_km: 5.23,
        duration_min: 31.3,
        avg_pace_min_km: null,
        avg_hr: 151,
        source: "fit",
      },
    ]);
  });

  it("drops malformed dates, non-positive metrics, and junk", () => {
    expect(
      sanitizeActivities([
        { date: "yesterday", distance_km: 5, duration_min: 30 },
        { date: "2026-07-08", distance_km: 0, duration_min: 30 },
        { date: "2026-07-08", distance_km: 5, duration_min: -1 },
        { date: "2026-07-08", distance_km: 999, duration_min: 30 },
        null,
        "x",
      ]),
    ).toEqual([]);
    expect(sanitizeActivities("junk")).toEqual([]);
  });
});

describe("splitImportableActivities", () => {
  const today = "2026-07-09";

  it("imports in-window dates, skipping existing logs and future/old dates", () => {
    const split = splitImportableActivities(
      [run("2026-07-08"), run("2026-07-07"), run("2026-07-10"), run("2026-06-01")],
      ["2026-07-07"],
      today,
    );
    expect(split.importable.map((a) => a.date)).toEqual(["2026-07-08"]);
    expect(split.duplicates).toEqual(["2026-07-07"]);
    expect(split.outOfWindow).toEqual(["2026-07-10", "2026-06-01"]);
  });

  it("imports the same date only once across two files", () => {
    const split = splitImportableActivities(
      [run("2026-07-08"), run("2026-07-08")],
      [],
      today,
    );
    expect(split.importable).toHaveLength(1);
    expect(split.duplicates).toEqual(["2026-07-08"]);
  });

  it("accepts the window boundary (13 days back) and today", () => {
    const split = splitImportableActivities(
      [run("2026-06-26"), run("2026-06-25"), run(today)],
      [],
      today,
    );
    expect(split.importable.map((a) => a.date)).toEqual([
      "2026-06-26",
      today,
    ]);
    expect(split.outOfWindow).toEqual(["2026-06-25"]);
  });
});
