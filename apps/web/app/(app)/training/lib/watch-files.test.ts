import { describe, expect, it } from "vitest";
import { activityLine, intakeActivities, watchDataNote, watchFilesForm } from "./watch-files";

const run = {
  date: "2026-09-20",
  distanceKm: 5.01,
  durationMin: 27.1,
  avgPaceMinKm: 5.4,
  avgHr: 152,
  source: "fit" as const,
};

describe("watch files", () => {
  it("describes a parsed run", () => {
    expect(activityLine(run)).toBe("2026-09-20: 5.01km · 27.1min · 152 bpm");
    expect(activityLine({ ...run, avgHr: null })).toBe("2026-09-20: 5.01km · 27.1min");
  });

  it("says how the runs are used", () => {
    expect(watchDataNote(0)).toBe("No watch data — the plan uses your answers and PBs.");
    expect(watchDataNote(1)).toBe("1 uploaded run will inform your paces.");
    expect(watchDataNote(3)).toBe("3 uploaded runs will inform your paces.");
  });

  it("maps runs to the intake's snake_case shape", () => {
    expect(intakeActivities([run])).toEqual([
      { date: "2026-09-20", distance_km: 5.01, duration_min: 27.1, avg_pace_min_km: 5.4, avg_hr: 152, source: "fit" },
    ]);
  });

  it("puts every file under one field", () => {
    const form = watchFilesForm([new File(["a"], "a.fit"), new File(["b"], "b.gpx")]);
    expect(form.getAll("activities").map((f) => (f as File).name)).toEqual(["a.fit", "b.gpx"]);
  });
});
