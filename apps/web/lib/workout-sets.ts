/**
 * Strength-logging math the log sheet needs before the API answers: prefill
 * from a plan prescription and the live total-volume line. The API owns this
 * math (apps/api/internal/domain/workout); this copy replays the same golden
 * vectors. Volume is a celebration stat, never an XP input.
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

/** Σ weight × reps across every set to one decimal; non-finite or negative values count 0. */
export function totalVolumeKg(exercises: LoggedExercise[]): number {
  let total = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      const weight = Number.isFinite(set.weight_kg) && set.weight_kg > 0 ? set.weight_kg : 0;
      const reps = Number.isFinite(set.reps) && set.reps > 0 ? set.reps : 0;
      total += weight * reps;
    }
  }
  return Math.round(total * 10) / 10;
}

/** Descending thresholds — the first entry the volume clears wins. */
const VOLUME_EQUIVALENCES = [
  { minKg: 4000, label: "an adult elephant", emoji: "🐘" },
  { minKg: 1500, label: "a small car", emoji: "🚗" },
  { minKg: 700, label: "a grand piano", emoji: "🎹" },
  { minKg: 400, label: "a horse", emoji: "🐎" },
  { minKg: 180, label: "a refrigerator", emoji: "🧊" },
  { minKg: 80, label: "a washing machine", emoji: "🧺" },
];

/** A real-world comparison for a total volume; null below the lightest one. */
export function volumeEquivalence(kg: number): { label: string; emoji: string } | null {
  if (!Number.isFinite(kg)) return null;
  const match = VOLUME_EQUIVALENCES.find((entry) => kg >= entry.minKg);
  return match ? { label: match.label, emoji: match.emoji } : null;
}

/** " — that's a grand piano 🎹", or "" below the lightest comparison. */
export function equivalenceSuffix(kg: number): string {
  const equivalence = volumeEquivalence(kg);
  return equivalence ? ` — that's ${equivalence.label} ${equivalence.emoji}` : "";
}

/** Kilograms as the legacy app printed them: 1,250 / 1,250.5. */
export function formatKg(kg: number): string {
  return kg.toLocaleString("en-US");
}

const SET_REP_PATTERN = /(\d+)\s*[x×]\s*(\d+)(?:\s*[-–]\s*(\d+))?/i;

/**
 * Reads a prescription like "DB Goblet Squat 3x10-12 + DB Floor Press 3x10-12"
 * (also one per line) into prefillable exercises. Segments without an NxM
 * pattern or a name are skipped.
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
    if (!match) continue;

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
