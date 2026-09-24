import { describe, expect, it } from "vitest";

import {
  exerciseTopSets,
  weeklyKm,
  weeklyVolume,
  weightSeries,
  type SessionLogRow,
} from "./progress-charts";

// Wednesday 2026-07-08; its Monday is 2026-07-06.
const TODAY = new Date("2026-07-08T12:00:00");

const strengthLog = (
  createdAt: string,
  exercises: unknown,
): SessionLogRow => ({
  created_at: createdAt,
  sport: "strength",
  actual: { exercises },
});

describe("weeklyVolume", () => {
  it("buckets volume into contiguous Monday weeks with zeros kept", () => {
    const logs = [
      strengthLog("2026-07-07T10:00:00Z", [
        { name: "Squat", sets: [{ weight_kg: 50, reps: 10 }] },
      ]),
      strengthLog("2026-06-30T10:00:00Z", [
        { name: "Squat", sets: [{ weight_kg: 40, reps: 10 }] },
      ]),
      // run logs are ignored
      { created_at: "2026-07-07T10:00:00Z", sport: "run", actual: { distance_km: 5 } },
    ];
    const points = weeklyVolume(logs, TODAY, 4);
    expect(points).toHaveLength(4);
    expect(points[3]).toEqual({ label: "Jul 6", value: 500 });
    expect(points[2]).toEqual({ label: "Jun 29", value: 400 });
    expect(points[0].value).toBe(0);
  });
});

describe("weeklyKm", () => {
  it("sums run distances per week and rounds to 0.1", () => {
    const logs: SessionLogRow[] = [
      { created_at: "2026-07-06T08:00:00Z", sport: "run", actual: { distance_km: 5.25 } },
      { created_at: "2026-07-07T08:00:00Z", sport: "run", actual: { distance_km: 3.1 } },
      { created_at: "2026-07-07T09:00:00Z", sport: "run", actual: {} },
    ];
    const points = weeklyKm(logs, TODAY, 2);
    expect(points[1].value).toBeCloseTo(8.4);
  });
});

describe("exerciseTopSets", () => {
  it("charts the most-logged exercises' top set per session, oldest first", () => {
    const logs = [
      strengthLog("2026-06-01T10:00:00Z", [
        { name: "Goblet Squat", sets: [{ weight_kg: 16, reps: 10 }, { weight_kg: 20, reps: 8 }] },
      ]),
      strengthLog("2026-06-08T10:00:00Z", [
        { name: "goblet squat", sets: [{ weight_kg: 22, reps: 8 }] },
      ]),
      strengthLog("2026-06-15T10:00:00Z", [
        { name: "Goblet Squat", sets: [{ weight_kg: 24, reps: 8 }] },
        { name: "Bench", sets: [{ weight_kg: 40, reps: 5 }] },
      ]),
    ];
    const trends = exerciseTopSets(logs, 3);
    expect(trends).toHaveLength(1); // Bench has only 1 session
    expect(trends[0].name).toBe("Goblet Squat");
    expect(trends[0].points.map((p) => p.value)).toEqual([20, 22, 24]);
  });

  it("returns [] when nothing reaches the minimum session count", () => {
    expect(exerciseTopSets([], 3)).toEqual([]);
  });

  it("buckets sessions by local day, matching the weekly charts", () => {
    // Two logs on the same LOCAL day (whatever the zone) merge into one point.
    const morning = new Date(2026, 5, 1, 9, 0, 0);
    const evening = new Date(2026, 5, 1, 21, 0, 0);
    const logs = [
      strengthLog(morning.toISOString(), [
        { name: "Squat", sets: [{ weight_kg: 50, reps: 5 }] },
      ]),
      strengthLog(evening.toISOString(), [
        { name: "Squat", sets: [{ weight_kg: 55, reps: 5 }] },
      ]),
    ];
    const trends = exerciseTopSets(logs, 1);
    expect(trends[0].points).toHaveLength(1);
    expect(trends[0].points[0].value).toBe(55);
  });
});

describe("weightSeries", () => {
  it("sorts ascending and drops null/zero weights", () => {
    const points = weightSeries([
      { measured_at: "2026-07-01T08:00:00Z", weight_kg: 82.46 },
      { measured_at: "2026-06-01T08:00:00Z", weight_kg: 84 },
      { measured_at: "2026-06-15T08:00:00Z", weight_kg: null },
    ]);
    expect(points.map((p) => p.value)).toEqual([84, 82.5]);
  });

  it("labels date-only measurements as that local day (no UTC shift)", () => {
    const points = weightSeries([{ measured_at: "2026-07-01", weight_kg: 80 }]);
    expect(points[0].label).toBe("Jul 1");
  });
});
