import { describe, expect, it } from "vitest";

import { MAX_HEARTS, nextStreakState, type StreakState } from "./streak";

const base: StreakState = { streak: 5, best: 8, hearts: 2 };

describe("nextStreakState", () => {
  it("extends the streak and regains a heart when trained", () => {
    expect(nextStreakState(base, { trained: true, requiredDay: true })).toEqual(
      { streak: 6, best: 8, hearts: 3 },
    );
  });

  it("caps hearts at MAX_HEARTS on a trained day", () => {
    const full = { streak: 1, best: 1, hearts: MAX_HEARTS };
    expect(
      nextStreakState(full, { trained: true, requiredDay: false }).hearts,
    ).toBe(MAX_HEARTS);
  });

  it("raises the best streak when the current one passes it", () => {
    const state = { streak: 8, best: 8, hearts: 1 };
    expect(nextStreakState(state, { trained: true, requiredDay: true })).toEqual(
      { streak: 9, best: 9, hearts: 2 },
    );
  });

  it("counts a trained day even when nothing was scheduled", () => {
    // Logging on a rest day still extends the streak.
    expect(
      nextStreakState(base, { trained: true, requiredDay: false }).streak,
    ).toBe(6);
  });

  it("leaves everything untouched on a rest day (not required, not trained)", () => {
    expect(
      nextStreakState(base, { trained: false, requiredDay: false }),
    ).toEqual(base);
  });

  it("spends a heart and freezes the streak on a missed required day", () => {
    expect(
      nextStreakState(base, { trained: false, requiredDay: true }),
    ).toEqual({ streak: 5, best: 8, hearts: 1 });
  });

  it("resets the streak and refills hearts when missing at 0 hearts", () => {
    const noHearts = { streak: 12, best: 12, hearts: 0 };
    expect(
      nextStreakState(noHearts, { trained: false, requiredDay: true }),
    ).toEqual({ streak: 0, best: 12, hearts: MAX_HEARTS });
  });

  it("takes three misses to reach 0, then a fourth to reset", () => {
    let state: StreakState = { streak: 10, best: 10, hearts: MAX_HEARTS };
    const miss = { trained: false, requiredDay: true };
    state = nextStreakState(state, miss); // 3 -> 2
    state = nextStreakState(state, miss); // 2 -> 1
    state = nextStreakState(state, miss); // 1 -> 0
    expect(state).toEqual({ streak: 10, best: 10, hearts: 0 });
    state = nextStreakState(state, miss); // reset
    expect(state).toEqual({ streak: 0, best: 10, hearts: MAX_HEARTS });
  });

  it("keeps the streak when a day required by two plans is trained via one log", () => {
    // Multi-plan: a running plan AND a hypertrophy plan both schedule this day
    // (requiredDay collapses their union to true). The user completed the run
    // but skipped the lift — any completed log makes the day trained, so the
    // streak extends and stays safe.
    expect(nextStreakState(base, { trained: true, requiredDay: true })).toEqual(
      { streak: 6, best: 8, hearts: 3 },
    );
  });

  it("spends a heart when a multi-plan required day has no completed log", () => {
    // Same two plans schedule the day, but nothing was completed anywhere —
    // a fully-missed required day spends a heart, streak frozen.
    expect(
      nextStreakState(base, { trained: false, requiredDay: true }),
    ).toEqual({ streak: 5, best: 8, hearts: 1 });
  });

  it("normalizes out-of-range hearts before applying rules", () => {
    const weird = { streak: 3, best: 3, hearts: 99 };
    expect(
      nextStreakState(weird, { trained: false, requiredDay: true }).hearts,
    ).toBe(MAX_HEARTS - 1);
  });
});
