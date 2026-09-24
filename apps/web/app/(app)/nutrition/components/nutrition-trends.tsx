import type { ReactNode } from "react";
import { kcalText, macroLine, microLine, type NutritionDay, type Trend } from "../lib/nutrition";
import { WeekBars } from "./week-bars";

function TrendCard({ title, trend, children }: { title: string; trend: Trend; children?: ReactNode }) {
  return (
    <div className='bg-card border-border space-y-3 rounded-2xl border p-4'>
      <div className='flex items-baseline justify-between'>
        <p className='text-foreground text-sm font-semibold'>{title}</p>
        <p className='text-stat text-brand-ink text-lg'>
          {kcalText(trend.avg.kcal)}
          <span className='text-muted-foreground font-sans text-xs font-medium'> avg kcal</span>
        </p>
      </div>
      {children}
      <div className='text-muted-foreground space-y-0.5 text-xs'>
        <p>{macroLine(trend.avg)}</p>
        <p>{microLine(trend.avg)}</p>
      </div>
      <p className='text-muted-foreground text-[11px]'>
        {trend.daysLogged} of {trend.totalDays} days logged
      </p>
    </div>
  );
}

/** Weekly and monthly averages over logged days; hidden until something is logged. */
export function NutritionTrends({ day }: { day: NutritionDay }) {
  if (day.week.daysLogged === 0 && day.month.daysLogged === 0) return null;
  return (
    <section className='space-y-2'>
      <h2 className='text-overline'>Trends</h2>
      <div className='grid gap-3 sm:grid-cols-2'>
        <TrendCard title='This week' trend={day.week}>
          <WeekBars week={day.week} target={day.target} />
        </TrendCard>
        <TrendCard title='This month' trend={day.month} />
      </div>
    </section>
  );
}
