/**
 * Weekly training scorecard + check-in decision rules (adaptive plan Phase 3).
 * Pure, client-safe math like lib/running.ts — zero AI, zero I/O, fully
 * unit-testable (see scripts/scorecard-check.ts).
 */

import { normalizeLoggedExercises } from "./workout-sets";

export type WeekScorecard = {
  /** Completed non-meal_note items / planned non-meal_note items, 0-100. */
  adherence_pct: number;
  planned_items: number;
  completed_items: number;
  planned_km: number;
  actual_km: number;
  /** Session-log notes/messages flagged "red" by the feedback layer. */
  red_flags: string[];
  /** Session-log notes/messages flagged "caution". */
  caution_flags: string[];
};

export type CheckinDecision = "advance" | "repeat" | "deload";

export type ScorecardItem = {
  item_type: string;
  is_completed: boolean;
  details: Record<string, unknown> | null;
};

export type ScorecardSessionLog = {
  actual: Record<string, unknown> | null;
  ai_feedback: Record<string, unknown> | null;
  note: string | null;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

/**
 * Deterministic weekly scorecard. `sessionLogs[i]` is the log for `items[i]`
 * (null/undefined when the item has no log) — pass them index-aligned so the
 * actual-km fallback can pair a completed run with its missing log.
 */
export function computeWeekScorecard(
  items: ScorecardItem[],
  sessionLogs: (ScorecardSessionLog | null | undefined)[],
): WeekScorecard {
  const trainable = items.filter((item) => item.item_type !== "meal_note");
  const planned = trainable.length;
  const completed = trainable.filter((item) => item.is_completed).length;
  // 0 planned items means nothing could be missed — treat as full adherence.
  const adherence =
    planned === 0 ? 100 : round1((completed / planned) * 100);

  let plannedKm = 0;
  let actualKm = 0;
  items.forEach((item, index) => {
    const log = sessionLogs[index] ?? null;
    if (item.item_type === "run") {
      const plannedDistance = numberOrNull(item.details?.distance_km);
      if (plannedDistance !== null) plannedKm += plannedDistance;
      const loggedDistance = numberOrNull(log?.actual?.distance_km);
      if (loggedDistance !== null) {
        actualKm += loggedDistance;
      } else if (item.is_completed && plannedDistance !== null) {
        // Completed run without a logged distance counts as planned distance.
        actualKm += plannedDistance;
      }
    }
  });

  const redFlags: string[] = [];
  const cautionFlags: string[] = [];
  for (const log of sessionLogs) {
    if (!log?.ai_feedback) continue;
    const flag = String(log.ai_feedback.flag ?? "");
    if (flag !== "red" && flag !== "caution") continue;
    const text =
      (typeof log.note === "string" && log.note.trim()) ||
      (typeof log.ai_feedback.message === "string" &&
        log.ai_feedback.message.trim()) ||
      "Flagged session";
    (flag === "red" ? redFlags : cautionFlags).push(text);
  }

  return {
    adherence_pct: adherence,
    planned_items: planned,
    completed_items: completed,
    planned_km: round1(plannedKm),
    actual_km: round1(actualKm),
    red_flags: redFlags,
    caution_flags: cautionFlags,
  };
}

/**
 * Hypertrophy stall detection (adaptive plan Phase 5): an exercise logged in
 * each of the last 3 weeks with no weight OR rep increase from first to last
 * is stalled — surface at check-in to suggest a deload or variation.
 * Pass per-week strength logs oldest → newest; needs ≥3 weeks of data.
 */
export function detectStalledLifts(
  weeklyStrengthLogs: (ScorecardSessionLog | null | undefined)[][],
): string[] {
  if (weeklyStrengthLogs.length < 3) return [];
  const lastThree = weeklyStrengthLogs.slice(-3);

  // Per week: exercise name → best (weight, reps) seen that week.
  // normalizeLoggedExercises accepts both the legacy flat rows and the
  // per-set shape logged since the Hevy-style editor.
  const weekMaps = lastThree.map((logs) => {
    const map = new Map<string, { weight: number; reps: number }>();
    for (const log of logs) {
      for (const exercise of normalizeLoggedExercises(log?.actual?.exercises)) {
        const name = exercise.name.toLowerCase();
        for (const set of exercise.sets) {
          const weight = numberOrNull(set.weight_kg) ?? 0;
          const reps = numberOrNull(set.reps) ?? 0;
          const best = map.get(name);
          if (!best || weight > best.weight || (weight === best.weight && reps > best.reps)) {
            map.set(name, { weight, reps });
          }
        }
      }
    }
    return map;
  });

  const stalled: string[] = [];
  for (const [name, first] of weekMaps[0]) {
    const mid = weekMaps[1].get(name);
    const last = weekMaps[2].get(name);
    if (!mid || !last) continue;
    if (last.weight <= first.weight && last.reps <= first.reps) {
      stalled.push(name);
    }
  }
  return stalled;
}

/**
 * Rules-first check-in decision (notes Decision 2): red flag → deload;
 * two consecutive weeks under 50% adherence → deload; one week under 50%
 * → repeat; otherwise advance.
 */
export function decideWeek(
  current: WeekScorecard,
  previous: WeekScorecard | null,
): { decision: CheckinDecision; reasons: string[] } {
  if (current.red_flags.length > 0) {
    return {
      decision: "deload",
      reasons: [
        `A session was red-flagged: "${current.red_flags[0]}" — easing off to recover.`,
      ],
    };
  }
  if (current.adherence_pct < 50) {
    if (previous && previous.adherence_pct < 50) {
      return {
        decision: "deload",
        reasons: [
          `Two weeks in a row under 50% adherence (${previous.adherence_pct}% then ${current.adherence_pct}%) — a lighter deload week rebuilds momentum.`,
        ],
      };
    }
    return {
      decision: "repeat",
      reasons: [
        `Only ${current.completed_items} of ${current.planned_items} sessions done (${current.adherence_pct}%) — repeating the week instead of advancing.`,
      ],
    };
  }
  const reasons = [
    `${current.completed_items} of ${current.planned_items} sessions done (${current.adherence_pct}%) — on track to advance.`,
  ];
  if (current.caution_flags.length > 0) {
    reasons.push(
      `Heads up: ${current.caution_flags.length} session${current.caution_flags.length === 1 ? "" : "s"} flagged for caution.`,
    );
  }
  return { decision: "advance", reasons };
}
