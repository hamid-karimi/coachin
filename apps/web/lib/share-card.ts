/**
 * Share-card data: builders turn app data into the card the canvas renderer draws
 * (`lib/share-card-canvas.ts`). Privacy rules live here so every entry point inherits
 * them: no body weight, no targets or missed-target framing — additive stats only.
 */
import { volumeEquivalence, type LoggedExercise } from "@/lib/workout-sets";

export type ShareCardStat = { label: string; value: string };

export type ShareCardData = {
  /** e.g. "Upper body — Day A"; the renderer wraps it to at most 2 lines. */
  headline: string;
  /** At most 3; empty stats are dropped. */
  stats: ShareCardStat[];
  /** Optional flourish, e.g. "that's a small car 🚗". */
  equivalence?: string;
  /** "Tue, Jul 9", or a range for progress cards. */
  dateLabel: string;
};

const MAX_STATS = 3;
const MAX_HEADLINE = 60;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** A stat, or null when there is nothing to show (dropped by `card`). */
type MaybeStat = ShareCardStat | null;

function card(headline: string, fallback: string, stats: MaybeStat[], dateLabel: string, equivalence?: string) {
  const data: ShareCardData = {
    headline: headline.trim().slice(0, MAX_HEADLINE) || fallback,
    stats: stats.filter((stat): stat is ShareCardStat => stat !== null).slice(0, MAX_STATS),
    dateLabel,
  };
  return equivalence ? { ...data, equivalence } : data;
}

/** A positive count with its label ("1 set", "3 sets"); null at zero. */
function count(n: number, singular: string, plural = singular): MaybeStat {
  return n > 0 ? { label: n === 1 ? singular : plural, value: n.toLocaleString("en-US") } : null;
}

/** "Tue, Jul 9" */
export function shareDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** Strength session: kg lifted, exercises, sets, and the equivalence line. */
export function sessionShareCard(input: {
  title: string;
  totalVolumeKg: number;
  exercises?: LoggedExercise[];
  date?: Date;
}): ShareCardData {
  const exercises = input.exercises ?? [];
  const sets = exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  const equivalence = volumeEquivalence(input.totalVolumeKg);
  return card(
    input.title,
    "Training day",
    [
      count(input.totalVolumeKg, "kg lifted"),
      count(exercises.length, "exercise", "exercises"),
      count(sets, "set", "sets"),
    ],
    shareDateLabel(input.date ?? new Date()),
    equivalence ? `that's ${equivalence.label} ${equivalence.emoji}` : undefined,
  );
}

/** One logged meal: kcal + protein. */
export function mealShareCard(input: { title: string; kcal: number; proteinG?: number | null; date?: Date }) {
  return card(
    input.title,
    "Meal",
    [
      { label: "kcal", value: Math.round(input.kcal).toLocaleString("en-US") },
      count(Math.round(input.proteinG ?? 0), "g protein"),
    ],
    shareDateLabel(input.date ?? new Date()),
  );
}

/** A day of eating: kcal, protein, meals. Never the target or a deficit. */
export function dayShareCard(input: { kcal: number; proteinG: number; mealsCount: number; date?: Date }) {
  return card(
    "Today's fuel",
    "Today's fuel",
    [
      { label: "kcal", value: Math.round(input.kcal).toLocaleString("en-US") },
      count(Math.round(input.proteinG), "g protein"),
      count(input.mealsCount, "meal", "meals"),
    ],
    shareDateLabel(input.date ?? new Date()),
  );
}

/** Whole weeks between two instants, at least 1. */
export function weeksBetween(fromIso: string, toIso: string): number {
  const ms = Math.abs(new Date(toIso).getTime() - new Date(fromIso).getTime());
  return Math.max(1, Math.round(ms / WEEK_MS));
}

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

/** Then-vs-now: the weeks between two progress photos (oldest first). */
export function progressShareCard(fromIso: string, toIso: string): ShareCardData {
  const weeks = weeksBetween(fromIso, toIso);
  return card(
    "Progress, not perfection",
    "Progress, not perfection",
    [{ label: weeks === 1 ? "week between" : "weeks between", value: String(weeks) }],
    `${monthLabel(fromIso)} → ${monthLabel(toIso)}`,
  );
}

/** The preview image's alt text: headline, then each stat. */
export function shareCardAlt(data: ShareCardData): string {
  return `Share card preview: ${[data.headline, ...data.stats.map((stat) => `${stat.value} ${stat.label}`)].join(", ")}`;
}
