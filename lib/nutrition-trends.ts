import { toLocalYMD } from "./dates";

/** Per-portion nutrient totals shared by a meal log and any aggregation. */
export interface MealNutrients {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
}

export interface DatedNutrients extends MealNutrients {
  date: string; // YYYY-MM-DD (local)
}

export interface DailyPoint {
  date: string;
  totals: MealNutrients;
}

export interface PeriodSummary {
  /** One point per day in the window, oldest → newest (missing days are 0). */
  series: DailyPoint[];
  /** Days in the window with at least one logged meal. */
  daysLogged: number;
  /** Length of the window in days. */
  totalDays: number;
  /** Averages over LOGGED days only (0 across the board when none). */
  avg: MealNutrients;
}

function emptyNutrients(): MealNutrients {
  return {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    sugar_g: 0,
    fiber_g: 0,
    sodium_mg: 0,
  };
}

function addInto(target: MealNutrients, row: MealNutrients): void {
  target.kcal += Number(row.kcal) || 0;
  target.protein_g += Number(row.protein_g) || 0;
  target.carbs_g += Number(row.carbs_g) || 0;
  target.fat_g += Number(row.fat_g) || 0;
  target.sugar_g += Number(row.sugar_g) || 0;
  target.fiber_g += Number(row.fiber_g) || 0;
  target.sodium_mg += Number(row.sodium_mg) || 0;
}

/** Shift a YYYY-MM-DD date by whole days in local time. */
function shiftYMD(ymd: string, deltaDays: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + deltaDays);
  return toLocalYMD(date);
}

/** Sum meal rows by their local date. */
export function aggregateDaily(
  rows: DatedNutrients[],
): Map<string, MealNutrients> {
  const byDay = new Map<string, MealNutrients>();
  for (const row of rows) {
    const totals = byDay.get(row.date) ?? emptyNutrients();
    addInto(totals, row);
    byDay.set(row.date, totals);
  }
  return byDay;
}

/**
 * Summarise the `days`-long window ending at `today` (inclusive): a per-day
 * series for charting, the count of logged days, and averages taken over
 * logged days only (so a few missing days don't drag the average to zero).
 */
export function summarizePeriod(
  rows: DatedNutrients[],
  days: number,
  today: string,
): PeriodSummary {
  const byDay = aggregateDaily(rows);
  const series: DailyPoint[] = [];
  const sum = emptyNutrients();
  let daysLogged = 0;

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = shiftYMD(today, -offset);
    const totals = byDay.get(date);
    if (totals) {
      daysLogged += 1;
      addInto(sum, totals);
    }
    series.push({ date, totals: totals ?? emptyNutrients() });
  }

  const avg = emptyNutrients();
  if (daysLogged > 0) {
    avg.kcal = Math.round(sum.kcal / daysLogged);
    avg.protein_g = Math.round(sum.protein_g / daysLogged);
    avg.carbs_g = Math.round(sum.carbs_g / daysLogged);
    avg.fat_g = Math.round(sum.fat_g / daysLogged);
    avg.sugar_g = Math.round(sum.sugar_g / daysLogged);
    avg.fiber_g = Math.round(sum.fiber_g / daysLogged);
    avg.sodium_mg = Math.round(sum.sodium_mg / daysLogged);
  }

  return { series, daysLogged, totalDays: days, avg };
}
