/**
 * Share-card data shaping (share-progress plan phase 1). Pure and
 * framework-free: builders turn app data into the card model the canvas
 * renderer draws. Privacy rules live HERE so every entry point inherits
 * them: no body weight, no missed-target framing — additive stats only.
 */
import { volumeEquivalence, type LoggedExercise } from "@/lib/workout-sets";

export type ShareCardStat = {
  label: string;
  value: string;
};

export type ShareCardData = {
  /** e.g. "Upper body — Day A" or "Tuesday's fuel". Max 2 rendered lines. */
  headline: string;
  /** Up to 3 stats; extras are dropped by the builder. */
  stats: ShareCardStat[];
  /** Optional flourish line, e.g. "that's a small car 🚗". */
  equivalence?: string;
  /** Human date label, e.g. "Tue, Jul 9". */
  dateLabel: string;
};

const MAX_STATS = 3;
const MAX_HEADLINE = 60;

function card(
  headline: string,
  fallbackHeadline: string,
  stats: ShareCardStat[],
  dateLabel: string,
  equivalence?: string,
): ShareCardData {
  return {
    headline: headline.trim().slice(0, MAX_HEADLINE) || fallbackHeadline,
    stats: stats.filter((stat) => stat.value !== "").slice(0, MAX_STATS),
    dateLabel,
    ...(equivalence ? { equivalence } : {}),
  };
}

export function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Strength session card: volume + sets, with the fun equivalence line. */
export function sessionShareCard(input: {
  title: string;
  totalVolumeKg: number;
  exercises?: LoggedExercise[];
  date?: Date;
}): ShareCardData {
  const setCount = (input.exercises ?? []).reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
  );
  const equivalence =
    input.totalVolumeKg > 0 ? volumeEquivalence(input.totalVolumeKg) : null;
  return card(
    input.title,
    "Training day",
    [
      input.totalVolumeKg > 0
        ? {
            label: "kg lifted",
            value: input.totalVolumeKg.toLocaleString("en-US"),
          }
        : { label: "", value: "" },
      (input.exercises?.length ?? 0) > 0
        ? { label: "exercises", value: String(input.exercises?.length) }
        : { label: "", value: "" },
      setCount > 0 ? { label: "sets", value: String(setCount) } : { label: "", value: "" },
    ],
    formatDateLabel(input.date ?? new Date()),
    equivalence
      ? `that's ${equivalence.label} ${equivalence.emoji}`
      : undefined,
  );
}

/** One meal (photo mode / logged meal): kcal + protein. */
export function mealShareCard(input: {
  title: string;
  kcal: number;
  proteinG?: number | null;
  date?: Date;
}): ShareCardData {
  return card(
    input.title,
    "Meal",
    [
      { label: "kcal", value: Math.round(input.kcal).toLocaleString("en-US") },
      input.proteinG && input.proteinG > 0
        ? { label: "g protein", value: String(Math.round(input.proteinG)) }
        : { label: "", value: "" },
    ],
    formatDateLabel(input.date ?? new Date()),
  );
}

/** A whole day of eating: kcal, protein, meals count. Additive only —
 *  targets and deficits never render on a card. */
export function dayShareCard(input: {
  kcal: number;
  proteinG: number;
  mealsCount: number;
  date?: Date;
}): ShareCardData {
  return card(
    "Today's fuel",
    "Today's fuel",
    [
      { label: "kcal", value: Math.round(input.kcal).toLocaleString("en-US") },
      input.proteinG > 0
        ? { label: "g protein", value: String(Math.round(input.proteinG)) }
        : { label: "", value: "" },
      input.mealsCount > 0
        ? {
            label: input.mealsCount === 1 ? "meal" : "meals",
            value: String(input.mealsCount),
          }
        : { label: "", value: "" },
    ],
    formatDateLabel(input.date ?? new Date()),
  );
}

/** Then-vs-now progress card (phase 2): weeks between two photos. */
export function progressShareCard(input: {
  fromLabel: string;
  toLabel: string;
  weeksBetween: number;
}): ShareCardData {
  return card(
    "Progress, not perfection",
    "Progress, not perfection",
    [
      {
        label: input.weeksBetween === 1 ? "week between" : "weeks between",
        value: String(input.weeksBetween),
      },
    ],
    `${input.fromLabel} → ${input.toLabel}`,
  );
}
