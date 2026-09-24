/**
 * Golden vectors: run the LEGACY TypeScript formulas over edge cases and
 * seeded random inputs, and write testdata/golden/<topic>.json. The Go port in
 * apps/api/internal/domain replays the same files, which proves both
 * implementations agree (plan Phase 1, ADR-5).
 *
 *   make golden     (TZ=UTC, like the API container)
 *
 * Deleted together with legacy/ at cutover.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { levelProgress } from "@/lib/xp";
import { leagueTierFromXp, tierFromLeague } from "@/lib/tiers";
import { nextStreakState, type StreakState } from "@/lib/streak";
import {
  clampBaseWeeks,
  formatSeconds,
  parseTimeToSeconds,
  raceDistanceKm,
  riegelSeconds,
  suggestGoalForDistance,
  type RaceTarget,
} from "@/lib/running";
import {
  daysUntil,
  lastElapsedPlanWeek,
  mondayOf,
  planItemDate,
  planWeekForDate,
  planWeekOf,
  toLocalYMD,
  weeksSince,
  yearsSince,
} from "@/lib/dates";

import { GOAL_TYPE_META, goalProgress } from "@/lib/goals";
import { quotaProgress, type QuotaLog } from "@/lib/weekly-quotas";
import {
  normalizeLoggedExercises,
  parsePrescription,
  totalVolumeKg,
  volumeEquivalence,
} from "@/lib/workout-sets";
import {
  computeWeekScorecard,
  decideWeek,
  detectStalledLifts,
  type ScorecardItem,
  type ScorecardSessionLog,
} from "@/lib/scorecard";

import { computeTargets, canComputeTargets, type NutritionGoal } from "@/lib/nutrition-targets";
import { FOOD_UNIT_OPTIONS, isFoodUnit, toGrams } from "@/lib/food-units";
import { mealAdherenceForDay } from "@/lib/meal-adherence";
import { isSupplementDue, scheduleLabel, type SupplementScheduleType } from "@/lib/supplement-schedule";
import { supplementTakenRate } from "@/lib/supplement-adherence";
import { buildGroceryList } from "@/lib/meal-plan-grocery";
import { summarizePeriod, type DatedNutrients } from "@/lib/nutrition-trends";

if (process.env.TZ !== "UTC") {
  throw new Error("run with TZ=UTC (the API's pinned zone) — use `make golden`");
}

const OUT_DIR = new URL("../../testdata/golden/", import.meta.url);

type Case = Record<string, unknown>;

function write(topic: string, cases: Case[]) {
  mkdirSync(OUT_DIR, { recursive: true });
  const body = { generatedBy: "scripts/golden/generate.ts", topic, cases };
  writeFileSync(new URL(`${topic}.json`, OUT_DIR), JSON.stringify(body, null, 1) + "\n");
  console.log(`${topic}: ${cases.length} cases`);
}

/** Deterministic PRNG (mulberry32) so regenerating yields identical files. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run fn as if the clock read `iso` (covers Date.now() and `new Date()`). */
function atTime<T>(iso: string, fn: () => T): T {
  const RealDate = Date;
  const fixed = new RealDate(iso).getTime();
  class FixedDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof Date> | []) {
      if (args.length === 0) super(fixed);
      else super(...(args as ConstructorParameters<typeof Date>));
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

// ---- xp (FORMULAS §1) -------------------------------------------------------
function xpCases(): Case[] {
  const next = rng(1);
  const xps = [-5, 0, 1, 999, 1000, 1001, 2500, 12345, 999_999];
  for (let i = 0; i < 40; i++) xps.push(Math.floor(next() * 200_000));
  return xps.map((xp) => ({ xp, want: levelProgress(xp) }));
}

// ---- tiers (FORMULAS §3) ----------------------------------------------------
function tierCases(): Case[] {
  const next = rng(2);
  const xps = [-1, 0, 4999, 5000, 5001, 19_999, 20_000, 49_999, 50_000, 1_000_000];
  for (let i = 0; i < 30; i++) xps.push(Math.floor(next() * 80_000));
  const leagues = ["bronze", "silver", "gold", "platinum", "GOLD", " Silver ", "diamond", "", null];
  return [
    ...xps.map((xp) => ({ fn: "leagueTierFromXp", xp, want: leagueTierFromXp(xp) })),
    ...leagues.map((league) => ({ fn: "tierFromLeague", league, want: tierFromLeague(league) })),
  ];
}

// ---- streak (FORMULAS §2) ---------------------------------------------------
function streakCases(): Case[] {
  const next = rng(3);
  const cases: Case[] = [];
  const starts: StreakState[] = [
    { streak: 0, best: 0, hearts: 3 },
    { streak: 5, best: 9, hearts: 0 },
    { streak: 2, best: 2, hearts: -1 }, // out-of-range hearts are clamped
    { streak: 7, best: 7, hearts: 9 },
    // (Fractional hearts are not generated: hearts is an integer column and an
    // int in Go, so that input cannot occur.)
  ];
  for (let i = 0; i < 40; i++) {
    starts.push({
      streak: Math.floor(next() * 20),
      best: 20 + Math.floor(next() * 20),
      hearts: Math.floor(next() * 4),
    });
  }
  for (const start of starts) {
    const days = Array.from({ length: 30 }, () => ({
      trained: next() < 0.5,
      requiredDay: next() < 0.6,
    }));
    const states: StreakState[] = [];
    let state = start;
    for (const day of days) {
      state = nextStreakState(state, day);
      states.push(state);
    }
    cases.push({ start, days, states });
  }
  return cases;
}

// ---- running (FORMULAS §4) --------------------------------------------------
function runningCases(): Case[] {
  const next = rng(4);
  const cases: Case[] = [];
  const distances = [5, 10, 21.0975, 42.195, 50, 0, -1];
  for (const d1 of distances) {
    for (const d2 of distances) {
      for (const t1 of [0, 1200, 1500, 3000, 6300, 14_370]) {
        cases.push({ fn: "riegelSeconds", d1, t1, d2, want: riegelSeconds(d1, t1, d2) });
      }
    }
  }
  for (const value of ["4:05", "3:59:30", " 25:00 ", "1:2:3:4", "abc", "", "-1:00", "12", "0:00", "1.5:00"]) {
    cases.push({ fn: "parseTimeToSeconds", value, want: parseTimeToSeconds(value) });
  }
  const seconds = [0, 59.4, 59.5, 60, 245, 3599.5, 3600, 14_370, -30];
  for (let i = 0; i < 30; i++) seconds.push(Math.floor(next() * 40_000) + next());
  for (const s of seconds) cases.push({ fn: "formatSeconds", seconds: s, want: formatSeconds(s) });
  for (const value of [null, 3, 4, 4.4, 4.5, 8, 12, 24, 24.6, 30, -2]) {
    cases.push({ fn: "clampBaseWeeks", value, want: clampBaseWeeks(value) });
  }
  const targets: RaceTarget[] = ["5k", "10k", "half", "full", "ultra", "other"];
  for (const target of targets) {
    for (const customKm of [null, 0, -3, 50, 100]) {
      cases.push({ fn: "raceDistanceKm", target, customKm, want: raceDistanceKm(target, customKm) });
    }
  }
  const pbSets = [
    {},
    { pb_5k: "25:00" },
    { pb_10k: "50:30", pb_5k: "24:10" },
    { pb_half: "1:52:00", pb_10k: "bad" },
    { pb_full: "3:59:30", pb_half: "1:45:00" },
    { pb_full: "", pb_half: "0:00", pb_10k: "48:00" },
  ];
  for (const pbs of pbSets) {
    for (const targetKm of [0, 5, 10, 21.0975, 42.195, 50, 100]) {
      cases.push({ fn: "suggestGoalForDistance", pbs, targetKm, want: suggestGoalForDistance(pbs, targetKm) });
    }
  }
  return cases;
}

// ---- dates (FORMULAS §9) ----------------------------------------------------
function dateCases(): Case[] {
  const next = rng(5);
  const cases: Case[] = [];
  const created = [
    "2026-07-05T14:03:00.123+00:00", // a Sunday
    "2026-07-06T00:00:00+00:00", // a Monday at midnight
    "2026-07-08T23:59:59+00:00", // a Wednesday
    "2025-12-31T12:00:00+00:00", // across a year boundary
    "2026-03-01T08:00:00+00:00",
  ];
  const nows = [
    "2026-07-05T15:00:00Z",
    "2026-07-06T00:00:00Z",
    "2026-07-12T23:59:59Z",
    "2026-07-13T00:00:01Z",
    "2026-09-24T18:00:00Z",
    "2027-01-04T09:00:00Z",
  ];
  for (const createdAt of created) {
    for (const now of nows) {
      cases.push({ fn: "planWeekForDate", createdAt, date: now, want: planWeekForDate(createdAt, new Date(now)) });
      for (const weeksTotal of [1, 8, 16]) {
        cases.push({ fn: "planWeekOf", createdAt, weeksTotal, now, want: atTime(now, () => planWeekOf(createdAt, weeksTotal)) });
        cases.push({ fn: "lastElapsedPlanWeek", createdAt, weeksTotal, now, want: atTime(now, () => lastElapsedPlanWeek(createdAt, weeksTotal)) });
      }
      cases.push({ fn: "weeksSince", timestamp: createdAt, now, want: atTime(now, () => weeksSince(createdAt)) });
    }
    for (const week of [1, 2, 8]) {
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        cases.push({ fn: "planItemDate", createdAt, week, dayOfWeek, want: toLocalYMD(planItemDate(createdAt, week, dayOfWeek)) });
      }
    }
  }
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2025, 0, 1) + Math.floor(next() * 800) * 86_400_000 + Math.floor(next() * 86_400_000));
    cases.push({ fn: "mondayOf", date: d.toISOString(), want: toLocalYMD(mondayOf(d)) });
  }
  for (const now of nows) {
    for (const date of ["2026-07-05", "2026-07-13", "2026-12-25", "2020-01-01"]) {
      cases.push({ fn: "daysUntil", date, now, want: atTime(now, () => daysUntil(date)) });
    }
    for (const birth of ["1990-07-06", "1990-07-05", "2000-02-29", "", null, "not-a-date"]) {
      cases.push({ fn: "yearsSince", date: birth, now, want: atTime(now, () => yearsSince(birth)) });
    }
  }
  return cases;
}

// ---- goals (FORMULAS §6) ----------------------------------------------------
function goalCases(): Case[] {
  const next = rng(6);
  const cases: Case[] = [{ fn: "GOAL_TYPE_META", want: GOAL_TYPE_META }];
  const fixed: [number | null, number, number | null][] = [
    [90, 80, 85], [90, 80, 80], [90, 80, 75], [90, 80, 95], [80, 80, 79],
    [null, 80, 85], [null, 80, 75], [null, 50, 25], [null, 50, 60], [20, 50, null],
    [10, 50, 30], [10, 50, 50], [10, 50, 5], [25, 20, 22.5], [null, 1500, 1800],
  ];
  for (const [start, target, current] of fixed) {
    cases.push({ fn: "goalProgress", start, target, current, want: goalProgress(start, target, current) });
  }
  for (let i = 0; i < 60; i++) {
    const start = next() < 0.2 ? null : Math.round(next() * 1000) / 10 + 1;
    const target = Math.round(next() * 1000) / 10 + 1;
    const current = next() < 0.1 ? null : Math.round(next() * 1200) / 10 + 0.5;
    cases.push({ fn: "goalProgress", start, target, current, want: goalProgress(start, target, current) });
  }
  return cases;
}

// ---- weekly quotas (FORMULAS §11) -------------------------------------------
function quotaCases(): Case[] {
  const next = rng(7);
  const cases: Case[] = [];
  for (let i = 0; i < 30; i++) {
    const quotas = [1, 2, 3].slice(0, 1 + Math.floor(next() * 3)).map((id) => ({
      sport_type_id: id,
      sessions_per_week: 1 + Math.floor(next() * 5),
    }));
    const statuses = ["completed", "completed", "skipped", "missed"];
    const logs: QuotaLog[] = Array.from({ length: Math.floor(next() * 12) }, () => ({
      sport_type_id: next() < 0.1 ? null : 1 + Math.floor(next() * 4),
      date: `2026-07-${String(6 + Math.floor(next() * 7)).padStart(2, "0")}`,
      status: statuses[Math.floor(next() * statuses.length)],
    }));
    cases.push({ quotas, logs, want: quotaProgress(quotas, logs) });
  }
  return cases;
}

// ---- strength sets (FORMULAS §12) -------------------------------------------
const FOREIGN_EXERCISES: unknown[] = [
  null,
  "not an array",
  [],
  [{ name: "Squat", sets: [{ weight_kg: 100, reps: 5 }, { weight_kg: 102.55, reps: 5 }] }],
  [{ name: "  Bench  ", sets: 3, reps: 10, weight_kg: 60 }],
  [{ name: "Row", sets: 3, reps: 10 }],
  [{ name: "Legacy", sets: 12, reps: 8, weight_kg: "40" }],
  [{ name: "Bad reps", sets: [{ weight_kg: 50, reps: 0 }, { weight_kg: 50, reps: 100 }, { weight_kg: 50, reps: 7.5 }] }],
  [{ name: "", sets: [{ weight_kg: 20, reps: 10 }] }, null, 5, { sets: [] }],
  [{ name: 42, sets: [{ weight_kg: -5, reps: "12" }, { weight_kg: null, reps: 3 }, { reps: 4 }] }],
  [{ name: "Curl", sets: [{ weight_kg: 12.34, reps: 12 }, "junk", null] }],
  [{ name: "x".repeat(100), sets: 2, reps: 5, weight_kg: 10 }],
  [{ name: "Deadlift 💪", sets: [{ weight_kg: 180, reps: 3 }] }],
  [{ name: "Many", sets: Array.from({ length: 14 }, (_, i) => ({ weight_kg: 10 + i, reps: 8 })) }],
  Array.from({ length: 25 }, (_, i) => ({ name: `Ex ${i}`, sets: 1, reps: 5 })),
];

function workoutCases(): Case[] {
  const next = rng(8);
  const cases: Case[] = [];
  for (const raw of FOREIGN_EXERCISES) {
    const normalized = normalizeLoggedExercises(raw);
    cases.push({ fn: "normalizeLoggedExercises", raw, want: normalized });
    cases.push({ fn: "totalVolumeKg", exercises: normalized, want: totalVolumeKg(normalized) });
  }
  for (const kg of [0, 79.9, 80, 179, 180, 400, 699, 700, 1500, 3999, 4000, 25_000, -1]) {
    cases.push({ fn: "volumeEquivalence", kg, want: volumeEquivalence(kg) });
  }
  for (let i = 0; i < 20; i++) {
    const kg = Math.floor(next() * 6000);
    cases.push({ fn: "volumeEquivalence", kg, want: volumeEquivalence(kg) });
  }
  for (const text of [
    "",
    "DB Goblet Squat 3x10-12 + DB Floor Press 3x10-12",
    "Back Squat 5x5\nBench Press 4 × 8–10\nPull-ups: 3x8",
    "Plank 3x60",
    "Warm-up jog\nRow 3X12",
    "Squat 0x5 + Lunge 3x0 + Curl 3x100",
    "Press 12x10",
    "3x10",
    "Deadlift · 1x5",
  ]) {
    cases.push({ fn: "parsePrescription", text, want: parsePrescription(text) });
  }
  return cases;
}

// ---- scorecard + check-in (FORMULAS §7) -------------------------------------
function scorecardCases(): Case[] {
  const next = rng(9);
  const cases: Case[] = [];
  const types = ["run", "run", "strength", "stretch", "mobility", "recovery", "meal_note"];
  const flags = [null, null, "green", "caution", "red"];
  const cards: ReturnType<typeof computeWeekScorecard>[] = [];
  for (let i = 0; i < 40; i++) {
    const n = Math.floor(next() * 8);
    const items: ScorecardItem[] = [];
    const logs: (ScorecardSessionLog | null)[] = [];
    for (let j = 0; j < n; j++) {
      const type = types[Math.floor(next() * types.length)];
      const distance = next() < 0.8 ? Math.round(next() * 150) / 10 : next() < 0.5 ? "10" : null;
      items.push({ item_type: type, is_completed: next() < 0.6, details: type === "run" ? { distance_km: distance } : null });
      const flag = flags[Math.floor(next() * flags.length)];
      logs.push(
        next() < 0.5
          ? null
          : {
              actual: next() < 0.7 ? { distance_km: Math.round(next() * 150) / 10 } : null,
              ai_feedback: flag ? { flag, message: next() < 0.5 ? "  Watch the knee  " : "" } : null,
              note: next() < 0.3 ? "Felt sharp pain" : next() < 0.5 ? "   " : null,
            },
      );
    }
    const card = computeWeekScorecard(items, logs);
    cards.push(card);
    cases.push({ fn: "computeWeekScorecard", items, logs, want: card });
  }
  for (let i = 0; i < cards.length; i++) {
    const previous = i % 3 === 0 ? null : cards[i - 1];
    cases.push({ fn: "decideWeek", current: cards[i], previous, want: decideWeek(cards[i], previous) });
  }
  const lift = (name: string, weight: number, reps: number): ScorecardSessionLog => ({
    actual: { exercises: [{ name, sets: [{ weight_kg: weight, reps }] }] },
    ai_feedback: null,
    note: null,
  });
  const stallSets: (ScorecardSessionLog | null)[][][] = [
    [],
    [[lift("Squat", 100, 5)], [lift("Squat", 100, 5)]],
    [[lift("Squat", 100, 5)], [lift("squat", 100, 5)], [lift("SQUAT", 100, 5)]],
    [[lift("Squat", 100, 5)], [lift("Squat", 100, 5)], [lift("Squat", 102.5, 5)]],
    [[lift("Bench", 60, 8)], [lift("Bench", 60, 8)], [lift("Bench", 60, 9)]],
    [[lift("Row", 50, 10)], [], [lift("Row", 50, 10)]],
    [[lift("Old", 1, 1)], [lift("Curl", 12, 10), null], [lift("Curl", 12, 10)], [lift("Curl", 12, 9)]],
    [[{ actual: { exercises: [{ name: "Press", sets: 3, reps: 8, weight_kg: 40 }] }, ai_feedback: null, note: null }],
     [lift("Press", 40, 8)], [lift("Press", 40, 8), lift("Dip", 0, 12)]],
  ];
  for (const weeks of stallSets) {
    cases.push({ fn: "detectStalledLifts", weeks, want: detectStalledLifts(weeks) });
  }
  return cases;
}

// ---- nutrition targets (FORMULAS §10) ----------------------------------------
function nutritionTargetCases(): Case[] {
  const next = rng(10);
  const goals: NutritionGoal[] = ["lose", "maintain", "gain", "recomp"];
  const sexes = ["male", "Female", "m", "F", "other", "", null];
  const cases: Case[] = [];
  const fixed = [
    { sex: "male", age: 35, heightCm: 180, weightKg: 82, trainingDaysPerWeek: 4, goal: "lose" as NutritionGoal },
    { sex: "female", age: 42, heightCm: 165, weightKg: 70, trainingDaysPerWeek: 0, goal: "maintain" as NutritionGoal },
    { sex: null, age: 30, heightCm: 175, weightKg: 75, trainingDaysPerWeek: 7, goal: "gain" as NutritionGoal },
    { sex: "male", age: null, heightCm: 180, weightKg: 82, trainingDaysPerWeek: 3, goal: "lose" as NutritionGoal },
    { sex: "male", age: 30, heightCm: 0, weightKg: 82, trainingDaysPerWeek: 3, goal: "lose" as NutritionGoal },
    { sex: "female", age: 80, heightCm: 150, weightKg: 45, trainingDaysPerWeek: 2.5, goal: "lose" as NutritionGoal },
    { sex: "male", age: 25, heightCm: 190, weightKg: 100, trainingDaysPerWeek: 12, goal: "recomp" as NutritionGoal },
    { sex: "male", age: 25, heightCm: 190, weightKg: 100, trainingDaysPerWeek: -3, goal: "gain" as NutritionGoal },
  ];
  for (const input of fixed) {
    cases.push({ input, can: canComputeTargets(input), want: computeTargets(input) });
  }
  for (let i = 0; i < 60; i++) {
    const input = {
      sex: sexes[Math.floor(next() * sexes.length)],
      age: 18 + Math.floor(next() * 60),
      heightCm: 150 + Math.round(next() * 500) / 10,
      weightKg: 45 + Math.round(next() * 800) / 10,
      trainingDaysPerWeek: Math.floor(next() * 8),
      goal: goals[Math.floor(next() * goals.length)],
    };
    cases.push({ input, can: canComputeTargets(input), want: computeTargets(input) });
  }
  return cases;
}

// ---- nutrition: units, meal adherence, trends, grocery (FORMULAS §8, §13) ---
function nutritionCases(): Case[] {
  const next = rng(11);
  const cases: Case[] = [{ fn: "FOOD_UNIT_OPTIONS", want: FOOD_UNIT_OPTIONS }];
  // (No "toString"-style names: legacy isFoodUnit uses `in`, so inherited
  // Object.prototype keys count as units and convert to NaN — a bug the Go
  // port fixes by treating every unknown unit as grams, as documented.)
  const units = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "oz", "lb", "slice", "piece", "handful", "serving", "bowl", "", "G"];
  for (const unit of units) {
    cases.push({ fn: "isFoodUnit", unit, want: isFoodUnit(unit) });
    for (const qty of [0, -1, 0.5, 1, 2.25, 3, 150]) {
      cases.push({ fn: "toGrams", qty, unit, want: toGrams(qty, unit) });
    }
  }
  const mealTypes = ["breakfast", "lunch", "dinner", "snack"];
  for (let i = 0; i < 25; i++) {
    const slot = () => ({ meal_type: mealTypes[Math.floor(next() * 4)], kcal: Math.round(next() * 9000) / 10 });
    const planned = Array.from({ length: Math.floor(next() * 5) }, slot);
    const logged = Array.from({ length: Math.floor(next() * 6) }, slot);
    cases.push({ fn: "mealAdherenceForDay", planned, logged, want: mealAdherenceForDay(planned, logged) });
  }
  for (let i = 0; i < 20; i++) {
    const today = `2026-0${1 + Math.floor(next() * 9)}-${String(1 + Math.floor(next() * 28)).padStart(2, "0")}`;
    const days = [1, 7, 14, 30][Math.floor(next() * 4)];
    const rows: DatedNutrients[] = Array.from({ length: Math.floor(next() * 20) }, () => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - Math.floor(next() * (days + 3)));
      return {
        date: d.toISOString().slice(0, 10),
        kcal: Math.round(next() * 9000) / 10,
        protein_g: Math.round(next() * 600) / 10,
        carbs_g: Math.round(next() * 900) / 10,
        fat_g: Math.round(next() * 400) / 10,
        sugar_g: Math.round(next() * 300) / 10,
        fiber_g: Math.round(next() * 150) / 10,
        sodium_mg: Math.round(next() * 20000) / 10,
      };
    });
    cases.push({ fn: "summarizePeriod", rows, days, today, want: summarizePeriod(rows, days, today) });
  }
  const groceryPlans = [
    [],
    [{ ingredients: null }, {}],
    [
      { ingredients: [{ name: "Oats", qty: "80g" }, { name: "banana" }, { name: "  " }] },
      { ingredients: [{ name: "oats" }, { name: "Banana" }, { name: "Éclair" }, { name: "apple" }, { name: "Zucchini" }] },
      { ingredients: [{ name: "eggs" }, { name: "Eggs" }, { name: "égg noodles" }, { name: "Apple" }, { name: "10 almonds" }, { name: "2 limes" }] },
    ],
  ];
  for (const items of groceryPlans) {
    cases.push({ fn: "buildGroceryList", items, want: buildGroceryList(items) });
  }
  return cases;
}

// ---- supplements (FORMULAS §13) ---------------------------------------------
function supplementCases(): Case[] {
  const next = rng(12);
  const cases: Case[] = [];
  const types: SupplementScheduleType[] = ["daily", "training_days", "custom"];
  const dayLists = [null, [], [0], [1, 3, 5], [6, 0, 2], [0, 1, 2, 3, 4, 5, 6]];
  for (const scheduleType of [...types, "unknown" as SupplementScheduleType]) {
    for (const daysOfWeek of dayLists) {
      const schedule = { scheduleType, daysOfWeek };
      cases.push({ fn: "scheduleLabel", schedule, want: scheduleLabel(schedule) });
      for (let weekday = 0; weekday <= 6; weekday++) {
        for (const isTrainingDay of [true, false]) {
          cases.push({ fn: "isSupplementDue", schedule, weekday, isTrainingDay, want: isSupplementDue(schedule, { weekday, isTrainingDay }) });
        }
      }
    }
  }
  for (let i = 0; i < 25; i++) {
    const schedule = { scheduleType: types[Math.floor(next() * 3)], daysOfWeek: dayLists[Math.floor(next() * dayLists.length)] };
    const window = Array.from({ length: 14 }, (_, d) => {
      const date = new Date(Date.UTC(2026, 6, 1 + d));
      return { ymd: date.toISOString().slice(0, 10), weekday: date.getUTCDay(), isTrainingDay: next() < 0.5 };
    });
    const createdYmd = `2026-07-${String(1 + Math.floor(next() * 16)).padStart(2, "0")}`;
    const taken = window.filter(() => next() < 0.6).map((day) => day.ymd);
    cases.push({
      fn: "supplementTakenRate", schedule, createdYmd, window, taken,
      want: supplementTakenRate(schedule, createdYmd, window, new Set(taken)),
    });
  }
  return cases;
}

write("nutrition-targets", nutritionTargetCases());
write("nutrition", nutritionCases());
write("supplements", supplementCases());
write("goals", goalCases());
write("quotas", quotaCases());
write("workout-sets", workoutCases());
write("scorecard", scorecardCases());
write("xp", xpCases());
write("tiers", tierCases());
write("streak", streakCases());
write("running", runningCases());
write("dates", dateCases());
