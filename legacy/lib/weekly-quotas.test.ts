import { describe, expect, it } from "vitest";

import { quotaProgress, type QuotaLog } from "./weekly-quotas";

const RUN = 1;
const STRENGTH = 2;

const completed = (sport: number, date: string): QuotaLog => ({
  sport_type_id: sport,
  date,
  status: "completed",
});

describe("quotaProgress", () => {
  it("returns an empty list for empty quotas", () => {
    expect(quotaProgress([], [completed(RUN, "2026-07-06")])).toEqual([]);
  });

  it("reports zero done when there are no logs", () => {
    expect(
      quotaProgress([{ sport_type_id: RUN, sessions_per_week: 2 }], []),
    ).toEqual([{ sport_type_id: RUN, target: 2, done: 0 }]);
  });

  it("reports partial progress", () => {
    expect(
      quotaProgress(
        [{ sport_type_id: RUN, sessions_per_week: 3 }],
        [completed(RUN, "2026-07-06")],
      ),
    ).toEqual([{ sport_type_id: RUN, target: 3, done: 1 }]);
  });

  it("reports a met quota", () => {
    expect(
      quotaProgress(
        [{ sport_type_id: RUN, sessions_per_week: 2 }],
        [completed(RUN, "2026-07-06"), completed(RUN, "2026-07-08")],
      ),
    ).toEqual([{ sport_type_id: RUN, target: 2, done: 2 }]);
  });

  it("lets done exceed the target (raw count — capping is a UI concern)", () => {
    expect(
      quotaProgress(
        [{ sport_type_id: RUN, sessions_per_week: 1 }],
        [
          completed(RUN, "2026-07-06"),
          completed(RUN, "2026-07-07"),
          completed(RUN, "2026-07-08"),
        ],
      ),
    ).toEqual([{ sport_type_id: RUN, target: 1, done: 3 }]);
  });

  it("counts two logs of the same sport on one day as a single session", () => {
    expect(
      quotaProgress(
        [{ sport_type_id: RUN, sessions_per_week: 2 }],
        [completed(RUN, "2026-07-06"), completed(RUN, "2026-07-06")],
      ),
    ).toEqual([{ sport_type_id: RUN, target: 2, done: 1 }]);
  });

  it("ignores non-completed logs", () => {
    expect(
      quotaProgress(
        [{ sport_type_id: RUN, sessions_per_week: 2 }],
        [
          { sport_type_id: RUN, date: "2026-07-06", status: "skipped" },
          { sport_type_id: RUN, date: "2026-07-07", status: "missed" },
        ],
      ),
    ).toEqual([{ sport_type_id: RUN, target: 2, done: 0 }]);
  });

  it("ignores logs of other sports and logs without a sport", () => {
    expect(
      quotaProgress(
        [{ sport_type_id: RUN, sessions_per_week: 2 }],
        [
          completed(STRENGTH, "2026-07-06"),
          { sport_type_id: null, date: "2026-07-07", status: "completed" },
        ],
      ),
    ).toEqual([{ sport_type_id: RUN, target: 2, done: 0 }]);
  });

  it("scores each quota independently", () => {
    expect(
      quotaProgress(
        [
          { sport_type_id: RUN, sessions_per_week: 2 },
          { sport_type_id: STRENGTH, sessions_per_week: 3 },
        ],
        [completed(RUN, "2026-07-06"), completed(STRENGTH, "2026-07-06")],
      ),
    ).toEqual([
      { sport_type_id: RUN, target: 2, done: 1 },
      { sport_type_id: STRENGTH, target: 3, done: 1 },
    ]);
  });
});
