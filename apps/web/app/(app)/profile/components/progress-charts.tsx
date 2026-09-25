"use client";

import { TrendLineChart, WeeklyBarsChart } from "@/components/design-system/progress-chart";
import { useProfileProgress } from "../hooks/use-profile";

/** Weekly volume / km bars, body weight and top-set lines; each hides without enough data. */
export function ProgressCharts() {
  const { weeklyVolume, weeklyKm, weight, topSets } = useProfileProgress();
  const hasVolume = weeklyVolume.some((point) => point.value > 0);
  const hasKm = weeklyKm.some((point) => point.value > 0);
  const hasWeight = weight.length >= 2;

  if (!hasVolume && !hasKm && !hasWeight && topSets.length === 0) {
    return (
      <div className='border-border rounded-xl border border-dashed p-5 text-center'>
        <p className='text-muted-foreground text-sm'>
          Charts appear here as you train: log strength sessions with weights, runs with distance, and body measurements
          — then watch the lines move.
        </p>
      </div>
    );
  }
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      {hasVolume && <WeeklyBarsChart title='Weekly volume' unit='kg' points={weeklyVolume} />}
      {hasKm && <WeeklyBarsChart title='Weekly running' unit='km' points={weeklyKm} />}
      {hasWeight && <TrendLineChart title='Body weight' unit='kg' points={weight} />}
      {topSets.map((trend) => (
        <TrendLineChart key={trend.name} title={`${trend.name} — top set`} unit='kg' points={trend.points} />
      ))}
    </div>
  );
}
