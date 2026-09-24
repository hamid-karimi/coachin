import { cn } from "@/lib/utils";
import { weekBars, type Trend } from "../lib/nutrition";

const TONE = { empty: "bg-secondary", hit: "bg-brand", logged: "bg-brand/50" } as const;

/** Seven daily kcal bars against the goal (dashed line) or the week's peak. */
export function WeekBars({ week, target }: { week: Trend; target: number | null | undefined }) {
  const { bars, goalPct } = weekBars(week, target);
  return (
    <div className='relative flex h-20 gap-1.5'>
      {goalPct !== null && (
        <div
          className='border-brand/40 pointer-events-none absolute inset-x-0 border-t border-dashed'
          style={{ bottom: `${goalPct}%` }}
          aria-hidden
        />
      )}
      {bars.map((bar) => (
        <div key={bar.date} className='flex flex-1 flex-col items-center gap-1'>
          <div className='flex w-full flex-1 items-end'>
            <div
              className={cn("w-full rounded-sm", TONE[bar.tone])}
              style={{ height: `${bar.heightPct}%` }}
              title={`${bar.initial} · ${Math.round(bar.kcal)} kcal`}
            />
          </div>
          <span className='text-muted-foreground text-[10px]'>{bar.initial}</span>
        </div>
      ))}
    </div>
  );
}
