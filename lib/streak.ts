/**
 * Personal streak + hearts state machine (pure). This is the canonical spec
 * of the rules; the evaluate_user_streak RPC mirrors it day-for-day. See
 * FORMULAS.md §2. Keep the two in sync when either changes.
 */

export const MAX_HEARTS = 3;

export type StreakState = {
  /** Consecutive settled days. */
  streak: number;
  /** Best streak ever reached. */
  best: number;
  /** Remaining "streak freeze" hearts, 0–MAX_HEARTS. */
  hearts: number;
};

export type DayOutcome = {
  /** A completed workout was logged that day (routine or plan). */
  trained: boolean;
  /** That day had a scheduled session — a routine or a non-meal plan item. */
  requiredDay: boolean;
};

function clampHearts(hearts: number): number {
  if (!Number.isFinite(hearts)) return MAX_HEARTS;
  return Math.max(0, Math.min(MAX_HEARTS, Math.trunc(hearts)));
}

/**
 * Apply one settled day to the streak/hearts state.
 *
 * - Trained → streak +1, best updated, regain a heart (capped).
 * - Rest day (not required, not trained) → nothing changes; the streak is safe.
 * - Missed a required day with hearts left → spend one, streak frozen.
 * - Missed a required day at 0 hearts → streak resets to 0, hearts refill.
 */
export function nextStreakState(
  state: StreakState,
  day: DayOutcome,
): StreakState {
  const hearts = clampHearts(state.hearts);

  if (day.trained) {
    const streak = state.streak + 1;
    return {
      streak,
      best: Math.max(state.best, streak),
      hearts: Math.min(hearts + 1, MAX_HEARTS),
    };
  }

  if (!day.requiredDay) {
    return { ...state, hearts };
  }

  if (hearts > 0) {
    return { ...state, hearts: hearts - 1 };
  }

  return { streak: 0, best: state.best, hearts: MAX_HEARTS };
}
