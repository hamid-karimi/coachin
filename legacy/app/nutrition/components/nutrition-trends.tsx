import { cn } from "@/lib/utils";
import type { MealNutrients, PeriodSummary } from "@/lib/nutrition-trends";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/** Weekday initial for a YYYY-MM-DD date, parsed in local time. */
function weekdayInitial(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return WEEKDAY[new Date(year, month - 1, day).getDay()];
}

function MacroLine({ avg }: { avg: MealNutrients }) {
  return (
    <div className="text-muted-foreground space-y-0.5 text-xs">
      <p>
        {avg.protein_g}g protein · {avg.carbs_g}g carbs · {avg.fat_g}g fat
      </p>
      <p>
        {avg.sugar_g}g sugar · {avg.fiber_g}g fiber · {avg.sodium_mg}mg sodium
      </p>
    </div>
  );
}

/** Seven-day kcal bars, scaled against the goal (or the week's own peak). */
function WeekBars({
  summary,
  target,
}: {
  summary: PeriodSummary;
  target: number | null;
}) {
  const peak = Math.max(
    target ?? 0,
    ...summary.series.map((point) => point.totals.kcal),
    1,
  );
  return (
    <div className="relative flex h-20 items-end gap-1.5">
      {target ? (
        <div
          className="border-brand/40 pointer-events-none absolute inset-x-0 border-t border-dashed"
          style={{ bottom: `${(target / peak) * 100}%` }}
          aria-hidden
        />
      ) : null}
      {summary.series.map((point) => {
        const height = peak > 0 ? (point.totals.kcal / peak) * 100 : 0;
        const hitGoal = target !== null && point.totals.kcal >= target;
        return (
          <div
            key={point.date}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-sm",
                  point.totals.kcal === 0
                    ? "bg-secondary"
                    : hitGoal
                      ? "bg-brand"
                      : "bg-brand/50",
                )}
                style={{ height: `${Math.max(height, point.totals.kcal > 0 ? 4 : 2)}%` }}
                title={`${weekdayInitial(point.date)} · ${Math.round(point.totals.kcal)} kcal`}
              />
            </div>
            <span className="text-muted-foreground text-[10px]">
              {weekdayInitial(point.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Weekly + monthly rollups of logged nutrition. */
export function NutritionTrends({
  week,
  month,
  target,
}: {
  week: PeriodSummary;
  month: PeriodSummary;
  target: number | null;
}) {
  if (week.daysLogged === 0 && month.daysLogged === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-overline">Trends</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* This week */}
        <div className="bg-card border-border space-y-3 rounded-2xl border p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-foreground text-sm font-semibold">This week</p>
            <p className="text-stat text-brand-ink text-lg">
              {week.avg.kcal.toLocaleString()}
              <span className="text-muted-foreground font-sans text-xs font-medium">
                {" "}
                avg kcal
              </span>
            </p>
          </div>
          <WeekBars summary={week} target={target} />
          <MacroLine avg={week.avg} />
          <p className="text-muted-foreground text-[11px]">
            {week.daysLogged} of {week.totalDays} days logged
          </p>
        </div>

        {/* This month */}
        <div className="bg-card border-border space-y-3 rounded-2xl border p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-foreground text-sm font-semibold">This month</p>
            <p className="text-stat text-brand-ink text-lg">
              {month.avg.kcal.toLocaleString()}
              <span className="text-muted-foreground font-sans text-xs font-medium">
                {" "}
                avg kcal
              </span>
            </p>
          </div>
          <MacroLine avg={month.avg} />
          <p className="text-muted-foreground text-[11px]">
            {month.daysLogged} of {month.totalDays} days logged
          </p>
        </div>
      </div>
    </section>
  );
}
