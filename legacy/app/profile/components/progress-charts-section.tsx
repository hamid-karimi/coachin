import {
  exerciseTopSets,
  weeklyKm,
  weeklyVolume,
  weightSeries,
  type MeasurementRow,
  type SessionLogRow,
} from "@/lib/progress-charts";
import {
  TrendLineChart,
  WeeklyBarsChart,
} from "@/components/design-system/progress-chart";

interface ProgressChartsSectionProps {
  sessionLogs: SessionLogRow[];
  measurements: MeasurementRow[];
}

/**
 * The evidence layer (share-progress plan phase 3): charts of what the user
 * actually did. Every chart hides itself without enough data; the section
 * shows an explainer when everything is empty. Server-rendered — the chart
 * primitives are dependency-free SVG/CSS.
 */
export function ProgressChartsSection({
  sessionLogs,
  measurements,
}: ProgressChartsSectionProps) {
  const today = new Date();
  const volume = weeklyVolume(sessionLogs, today);
  const km = weeklyKm(sessionLogs, today);
  const topSets = exerciseTopSets(sessionLogs);
  const weight = weightSeries(measurements);

  const hasVolume = volume.some((point) => point.value > 0);
  const hasKm = km.some((point) => point.value > 0);
  const hasWeight = weight.length >= 2;
  const hasAnything =
    hasVolume || hasKm || hasWeight || topSets.length > 0;

  if (!hasAnything) {
    return (
      <div className="border-border rounded-xl border border-dashed p-5 text-center">
        <p className="text-muted-foreground text-sm">
          Charts appear here as you train: log strength sessions with weights,
          runs with distance, and body measurements — then watch the lines
          move.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {hasVolume && (
        <WeeklyBarsChart title="Weekly volume" unit="kg" points={volume} />
      )}
      {hasKm && <WeeklyBarsChart title="Weekly running" unit="km" points={km} />}
      {hasWeight && (
        <TrendLineChart title="Body weight" unit="kg" points={weight} />
      )}
      {topSets.map((trend) => (
        <TrendLineChart
          key={trend.name}
          title={`${trend.name} — top set`}
          unit="kg"
          points={trend.points}
        />
      ))}
    </div>
  );
}
