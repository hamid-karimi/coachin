"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { $api } from "@/lib/api/browser";
import { MEAL_TYPE_LABEL } from "@/app/(app)/nutrition/lib/meal-plan";
import { dayKcal, takenRateText, targetsLine, traineeDayLabel, type TraineeDay } from "../lib/coaching";

const CARD = "bg-card border-border rounded-xl border p-4";

function DayCard({ day, kcalTarget }: { day: TraineeDay; kcalTarget?: number }) {
  const kcal = dayKcal(day, kcalTarget);
  return (
    <section className={`${CARD} space-y-1.5`}>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-[15px] font-bold'>{traineeDayLabel(day.date)}</h2>
        <Badge variant={kcal.over ? "flame" : "xp"}>{kcal.text}</Badge>
      </div>
      {day.meals.map((meal) => (
        <div key={meal.id} className='flex items-baseline justify-between gap-3 text-sm'>
          <p className='text-foreground min-w-0 truncate'>
            <span className='text-muted-foreground'>{MEAL_TYPE_LABEL[meal.mealType] ?? "Meal"} · </span>
            {meal.label}
          </p>
          <span className='text-muted-foreground shrink-0 text-xs'>
            {Math.round(meal.kcal)} kcal · {Math.round(meal.proteinG)}g protein
          </span>
        </div>
      ))}
      <p className='text-muted-foreground pt-1 text-xs'>
        Day total: {Math.round(day.totalKcal).toLocaleString("en-US")} kcal · {Math.round(day.totalProteinG)}g protein
      </p>
    </section>
  );
}

/** A coached trainee's last 7 days of meals and daily stack, read-only. */
export function TraineeNutritionView({ traineeId }: { traineeId: string }) {
  const data = $api.useSuspenseQuery("get", "/coaching/trainees/{id}/nutrition", {
    params: { path: { id: traineeId } },
  }).data;
  const targets = targetsLine(data.targets);

  return (
    <div className='mx-auto flex w-full max-w-3xl flex-col gap-5'>
      <header>
        <Link
          href='/coaching'
          className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm'>
          <ChevronLeft className='size-4' aria-hidden />
          Coaching
        </Link>
        <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-[28px]'>
          {data.name} — nutrition
        </h1>
        <p className='text-muted-foreground text-sm'>Last 7 days of meal logs, shared by your trainee.</p>
      </header>

      {!data.sharingEnabled ? (
        <p className={`${CARD} text-muted-foreground text-sm`}>
          {data.name} hasn&apos;t shared their nutrition with you. They can turn it on under Profile → Settings →
          &quot;Share nutrition with my coach&quot;.
        </p>
      ) : (
        <>
          {targets && <p className='text-muted-foreground text-sm'>{targets}</p>}
          {data.days.length === 0 ? (
            <p className={`${CARD} text-muted-foreground text-sm`}>No meals logged in the last 7 days.</p>
          ) : (
            data.days.map((day) => <DayCard key={day.date} day={day} kcalTarget={data.targets?.kcal} />)
          )}
          <section className={`${CARD} space-y-2`}>
            <h2 className='text-[15px] font-bold'>Daily stack</h2>
            {data.supplements.length === 0 ? (
              <p className='text-muted-foreground text-sm'>No supplements in their stack.</p>
            ) : (
              data.supplements.map((s) => (
                <div key={s.id} className='flex items-baseline justify-between gap-3 text-sm'>
                  <p className='text-foreground min-w-0 truncate'>
                    {s.name}
                    {s.dose && <span className='text-muted-foreground'> · {s.dose}</span>}
                    <span className='text-muted-foreground'> · {s.scheduleLabel}</span>
                  </p>
                  <span className='text-muted-foreground shrink-0 text-xs'>{takenRateText(s)}</span>
                </div>
              ))
            )}
          </section>
        </>
      )}
    </div>
  );
}
