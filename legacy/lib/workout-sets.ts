/**
 * Per-set strength logging math: parsing plan prescriptions into loggable
 * sets, normalizing logged payload shapes, and total-volume celebration.
 * Pure and framework-free like lib/scorecard.ts — no I/O, fully unit-tested.
 *
 * Volume is a stat and a celebration, NEVER an XP input (FORMULAS.md: session
 * log XP is a fixed +10, plan-item XP is a fixed per-type amount).
 */

export type SetEntry = { weight_kg: number; reps: number };

export type LoggedExercise = { name: string; sets: SetEntry[] };

export type ParsedExercise = {
  name: string;
  sets: number;
  repsLow: number;
  repsHigh: number | null;
};

const MAX_EXERCISES = 20;
const MAX_SETS_PER_EXERCISE = 10;
const MAX_NAME_LENGTH = 80;

/** Σ weight × reps across every set; non-finite or negative values count 0. */
export function totalVolumeKg(exercises: LoggedExercise[]): number {
  let total = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      const weight =
        Number.isFinite(set.weight_kg) && set.weight_kg > 0 ? set.weight_kg : 0;
      const reps = Number.isFinite(set.reps) && set.reps > 0 ? set.reps : 0;
      total += weight * reps;
    }
  }
  return Math.round(total * 10) / 10;
}

/** Descending thresholds — the first entry the volume clears wins. */
const VOLUME_EQUIVALENCES: { min_kg: number; label: string; emoji: string }[] =
  [
    { min_kg: 4000, label: "an adult elephant", emoji: "🐘" },
    { min_kg: 1500, label: "a small car", emoji: "🚗" },
    { min_kg: 700, label: "a grand piano", emoji: "🎹" },
    { min_kg: 400, label: "a horse", emoji: "🐎" },
    { min_kg: 180, label: "a refrigerator", emoji: "🧊" },
    { min_kg: 80, label: "a washing machine", emoji: "🧺" },
  ];

/** Fun real-world comparison for a total volume; null below the smallest
 *  threshold (a comparison to something lighter than the lift is no fun). */
export function volumeEquivalence(
  kg: number,
): { label: string; emoji: string } | null {
  if (!Number.isFinite(kg)) return null;
  const match = VOLUME_EQUIVALENCES.find((entry) => kg >= entry.min_kg);
  return match ? { label: match.label, emoji: match.emoji } : null;
}

const SET_REP_PATTERN = /(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?/i;

/**
 * Parse a plan prescription like
 * "DB Goblet Squat 3x10-12 + DB Floor Press 3x10-12" (also newline-separated)
 * into prefillable exercises. Tolerant: segments without an NxM pattern or a
 * name are skipped; a parse failure returns [] and the caller falls back to a
 * blank form.
 */
export function parsePrescription(text: string): ParsedExercise[] {
  if (!text) return [];
  const segments = text
    .split(/\s\+\s|\r?\n/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const exercises: ParsedExercise[] = [];
  for (const segment of segments) {
    if (exercises.length >= MAX_EXERCISES) break;
    const match = SET_REP_PATTERN.exec(segment);
    if (!match || match.index === undefined) continue;

    const name = segment
      .slice(0, match.index)
      .replace(/[\s:·,–-]+$/, "")
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    if (!name) continue;

    const sets = Math.min(Number(match[1]), MAX_SETS_PER_EXERCISE);
    const repsLow = Number(match[2]);
    const repsHigh = match[3] ? Number(match[3]) : null;
    if (sets < 1 || repsLow < 1 || repsLow > 99) continue;

    exercises.push({ name, sets, repsLow, repsHigh });
  }
  return exercises;
}

/**
 * Normalize a session log's `actual.exercises` into the per-set shape,
 * accepting both payload generations:
 * - new: `{ name, sets: [{ weight_kg, reps }] }`
 * - old: `{ name, sets: 3, reps: 10, weight_kg?: 20 }` → 3 identical entries
 * Invalid entries/sets are dropped; never throws on foreign data.
 */
export function normalizeLoggedExercises(raw: unknown): LoggedExercise[] {
  if (!Array.isArray(raw)) return [];
  const exercises: LoggedExercise[] = [];

  for (const entry of raw.slice(0, MAX_EXERCISES)) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;
    const name = String(item.name ?? "")
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    if (!name) continue;

    const sets = Array.isArray(item.sets)
      ? normalizeSetEntries(item.sets)
      : expandLegacyRow(item);
    if (sets.length === 0) continue;

    exercises.push({ name, sets });
  }
  return exercises;
}

function normalizeSetEntries(raw: unknown[]): SetEntry[] {
  const sets: SetEntry[] = [];
  for (const entry of raw.slice(0, MAX_SETS_PER_EXERCISE)) {
    if (typeof entry !== "object" || entry === null) continue;
    const set = entry as Record<string, unknown>;
    const reps = Number(set.reps);
    if (!Number.isInteger(reps) || reps < 1 || reps > 99) continue;
    const weightRaw = Number(set.weight_kg);
    const weight_kg =
      Number.isFinite(weightRaw) && weightRaw > 0
        ? Math.round(weightRaw * 10) / 10
        : 0;
    sets.push({ weight_kg, reps });
  }
  return sets;
}

function expandLegacyRow(item: Record<string, unknown>): SetEntry[] {
  const sets = Number(item.sets);
  const reps = Number(item.reps);
  if (!Number.isInteger(sets) || sets < 1) return [];
  if (!Number.isInteger(reps) || reps < 1 || reps > 99) return [];
  const weightRaw = Number(item.weight_kg);
  const weight_kg =
    Number.isFinite(weightRaw) && weightRaw > 0
      ? Math.round(weightRaw * 10) / 10
      : 0;
  return Array.from({ length: Math.min(sets, MAX_SETS_PER_EXERCISE) }, () => ({
    weight_kg,
    reps,
  }));
}
