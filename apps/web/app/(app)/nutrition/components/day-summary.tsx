import { Progress } from "@/components/ui/progress";
import { goalPercent, kcalText, macroLine, microLine, type NutritionDay } from "../lib/nutrition";

/** Today's kcal against the goal, with macros and micros. */
export function DaySummary({ day }: { day: NutritionDay }) {
  const pct = goalPercent(day.totals.kcal, day.target);
  return (
    <div className='bg-card border-border space-y-2.5 rounded-2xl border p-4'>
      <div className='flex items-baseline justify-between'>
        <p className='text-foreground text-sm font-semibold'>Today</p>
        <p className='text-stat text-brand-ink text-xl'>
          {kcalText(day.totals.kcal)}
          <span className='text-muted-foreground font-sans text-sm font-medium'>
            {" "}
            / {day.target ? kcalText(day.target) : "—"} kcal
          </span>
        </p>
      </div>
      {pct !== null ? (
        <Progress value={pct} aria-label='Calories eaten against your goal' />
      ) : (
        <p className='text-muted-foreground text-xs'>
          Set a daily calorie-intake goal on your profile to track this bar and earn the +30 XP adherence bonus.
        </p>
      )}
      <p className='text-muted-foreground text-xs'>{macroLine(day.totals)}</p>
      <p className='text-muted-foreground text-xs'>{microLine(day.totals)}</p>
    </div>
  );
}
