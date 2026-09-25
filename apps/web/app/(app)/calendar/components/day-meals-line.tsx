import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { adherenceText, plannedMealsText } from "@/app/(app)/nutrition/lib/meal-plan";
import type { CalendarDay } from "../lib/calendar";

/** The meal plan's per-day summary: a link to the plan, plus (today/past) how the logs compare. */
export function DayMealsLine({ meals }: { meals: NonNullable<CalendarDay["meals"]> }) {
  return (
    <div className='mt-2 flex flex-col gap-0.5'>
      <Link
        href='/nutrition/plan'
        className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors'>
        <UtensilsCrossed className='size-3' aria-hidden />
        {plannedMealsText(meals.plannedCount, meals.plannedKcal)}
      </Link>
      {meals.adherence && <p className='text-muted-foreground text-[11px]'>{adherenceText(meals.adherence)}</p>}
    </div>
  );
}
