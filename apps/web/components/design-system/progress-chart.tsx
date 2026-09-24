import { cn } from "@/lib/utils";

/** One labelled value on a chart axis (the API serves these series). */
export type ChartPoint = {
  /** Short axis label, e.g. "Jun 22" or "12 May". */
  label: string;
  value: number;
};

/**
 * Small, dependency-free progress charts (share-progress plan phase 3),
 * extending the nutrition-trends bar pattern into shared primitives.
 * Server-renderable — no client JS, no chart library.
 */

const CHART_HEIGHT = 80;

interface ChartCardProps {
  title: string;
  unit: string;
  children: React.ReactNode;
  /** Latest value headline, e.g. "82.5". */
  latest?: string;
}

function ChartCard({ title, unit, latest, children }: ChartCardProps) {
  return (
    <div className="bg-card border-border space-y-2 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        {latest && (
          <p className="text-stat text-brand-ink text-sm">
            {latest}
            <span className="text-muted-foreground font-sans text-xs font-medium">
              {" "}
              {unit}
            </span>
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

interface WeeklyBarsChartProps {
  title: string;
  unit: string;
  points: ChartPoint[];
}

/** Week-bucket bars (zero weeks stay visible as gaps — honest history). */
export function WeeklyBarsChart({ title, unit, points }: WeeklyBarsChartProps) {
  const peak = Math.max(...points.map((point) => point.value), 1);
  const latest = points[points.length - 1];

  return (
    <ChartCard
      title={title}
      unit={unit}
      latest={latest ? latest.value.toLocaleString("en-US") : undefined}
    >
      <div className="flex h-20 items-end gap-1.5">
        {points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-sm",
                  point.value === 0 ? "bg-secondary" : "bg-brand",
                )}
                style={{
                  height: `${Math.max((point.value / peak) * CHART_HEIGHT, point.value > 0 ? 4 : 2)}px`,
                }}
                title={`${point.label}: ${point.value.toLocaleString("en-US")} ${unit}`}
              />
            </div>
            <span className="text-muted-foreground text-[9px]">
              {point.label}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

interface TrendLineChartProps {
  title: string;
  unit: string;
  points: ChartPoint[];
}

/** SVG line for slow-moving series (weight, top sets): dots + first/last
 *  labels; the y-domain pads 10% around min..max so trends stay readable. */
export function TrendLineChart({ title, unit, points }: TrendLineChartProps) {
  if (points.length < 2) return null;

  const width = 300;
  const height = 80;
  const pad = 6;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.1);
  const domainMin = min - span * 0.1;
  const domainSpan = span * 1.2;

  const x = (index: number) =>
    pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) =>
    height - pad - ((value - domainMin) / domainSpan) * (height - pad * 2);

  const path = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`,
    )
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <ChartCard title={title} unit={unit} latest={last.value.toLocaleString("en-US")}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-20 w-full"
        role="img"
        aria-label={`${title}: ${first.value} ${unit} on ${first.label} to ${last.value} ${unit} on ${last.label}`}
      >
        <path
          d={path}
          fill="none"
          className="stroke-brand"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={x(index)}
            cy={y(point.value)}
            r={2.5}
            className="fill-brand"
          />
        ))}
      </svg>
      <div className="text-muted-foreground flex justify-between text-[10px]">
        <span>
          {first.label} · {first.value.toLocaleString("en-US")}
        </span>
        <span>
          {last.label} · {last.value.toLocaleString("en-US")}
        </span>
      </div>
    </ChartCard>
  );
}
