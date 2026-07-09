/**
 * Progress-chart aggregators (share-progress plan phase 3). Pure and
 * framework-free: pages fetch rows, these shape them into chart series.
 * All stats are additive evidence ("what you did"), never judgments.
 */
import { mondayOf, toLocalYMD } from "@/lib/dates";
import { normalizeLoggedExercises, totalVolumeKg } from "@/lib/workout-sets";

export type ChartPoint = {
  /** Short axis label, e.g. "Jun 22" or "12 May". */
  label: string;
  value: number;
};

export type SessionLogRow = {
  created_at: string;
  sport: string;
  actual: Record<string, unknown> | null;
};

export type MeasurementRow = {
  measured_at: string;
  weight_kg: number | null;
};

const DEFAULT_WEEKS = 8;

function shortLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Contiguous Monday-anchored week buckets ending at `today` (zeros kept so
 *  bars show gaps honestly). */
function weekBuckets(today: Date, weeks: number): { start: Date; key: string }[] {
  const currentMonday = mondayOf(today);
  return Array.from({ length: weeks }, (_, index) => {
    const start = new Date(currentMonday);
    start.setDate(currentMonday.getDate() - (weeks - 1 - index) * 7);
    return { start, key: toLocalYMD(start) };
  });
}

function weekKeyOf(iso: string): string {
  return toLocalYMD(mondayOf(new Date(iso)));
}

/** Total kg lifted per week from strength session logs. */
export function weeklyVolume(
  logs: SessionLogRow[],
  today: Date,
  weeks = DEFAULT_WEEKS,
): ChartPoint[] {
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (log.sport !== "strength") continue;
    const volume = totalVolumeKg(normalizeLoggedExercises(log.actual?.exercises));
    if (volume <= 0) continue;
    const key = weekKeyOf(log.created_at);
    totals.set(key, (totals.get(key) ?? 0) + volume);
  }
  return weekBuckets(today, weeks).map(({ start, key }) => ({
    label: shortLabel(start),
    value: Math.round(totals.get(key) ?? 0),
  }));
}

/** Kilometers run per week (logged distances only). */
export function weeklyKm(
  logs: SessionLogRow[],
  today: Date,
  weeks = DEFAULT_WEEKS,
): ChartPoint[] {
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (log.sport !== "run") continue;
    const distance = Number(log.actual?.distance_km);
    if (!Number.isFinite(distance) || distance <= 0) continue;
    const key = weekKeyOf(log.created_at);
    totals.set(key, (totals.get(key) ?? 0) + distance);
  }
  return weekBuckets(today, weeks).map(({ start, key }) => ({
    label: shortLabel(start),
    value: Math.round((totals.get(key) ?? 0) * 10) / 10,
  }));
}

export type ExerciseTrend = {
  name: string;
  points: ChartPoint[];
};

/**
 * Top-set (heaviest weight) per session for the user's most-logged
 * exercises — the "getting stronger" proof. Exercises need at least
 * `minSessions` logged sessions to chart; the top `maxExercises` by
 * session count are returned, points oldest → newest.
 */
export function exerciseTopSets(
  logs: SessionLogRow[],
  minSessions = 3,
  maxExercises = 3,
): ExerciseTrend[] {
  // exercise name (lowercased) → session date → top weight that day
  const byExercise = new Map<
    string,
    { display: string; sessions: Map<string, number> }
  >();

  const sorted = [...logs].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  for (const log of sorted) {
    if (log.sport !== "strength") continue;
    for (const exercise of normalizeLoggedExercises(log.actual?.exercises)) {
      const top = exercise.sets.reduce(
        (max, set) => Math.max(max, set.weight_kg),
        0,
      );
      if (top <= 0) continue;
      const key = exercise.name.toLowerCase();
      const entry = byExercise.get(key) ?? {
        display: exercise.name,
        sessions: new Map<string, number>(),
      };
      const day = log.created_at.slice(0, 10);
      entry.sessions.set(day, Math.max(entry.sessions.get(day) ?? 0, top));
      byExercise.set(key, entry);
    }
  }

  return [...byExercise.values()]
    .filter((entry) => entry.sessions.size >= minSessions)
    .sort((a, b) => b.sessions.size - a.sessions.size)
    .slice(0, maxExercises)
    .map((entry) => ({
      name: entry.display,
      points: [...entry.sessions.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, weight]) => ({
          label: shortLabel(new Date(`${day}T00:00:00`)),
          value: weight,
        })),
    }));
}

/** Body-weight series, oldest → newest, null weights dropped. */
export function weightSeries(measurements: MeasurementRow[]): ChartPoint[] {
  return measurements
    .filter(
      (row) =>
        row.weight_kg !== null &&
        Number.isFinite(Number(row.weight_kg)) &&
        Number(row.weight_kg) > 0,
    )
    .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
    .map((row) => ({
      label: shortLabel(new Date(row.measured_at)),
      value: Math.round(Number(row.weight_kg) * 10) / 10,
    }));
}
