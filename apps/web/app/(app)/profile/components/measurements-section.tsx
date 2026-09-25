"use client";

import { useRef, useState } from "react";
import { Loader2, Scale, X } from "lucide-react";
import { useConfettiBurst } from "@/components/hooks/use-confetti-burst";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddMeasurement, useDeleteMeasurement, useProfileProgress } from "../hooks/use-profile";
import { measurementDateLabel, measurementInput, measurementLine } from "../lib/profile";

/** Log weight / body fat (a crossed goal target bursts confetti) and the recent readings. */
export function MeasurementsSection() {
  const { measurements } = useProfileProgress();
  const formRef = useRef<HTMLFormElement>(null);
  const [celebrate, setCelebrate] = useState(false);
  const add = useAddMeasurement(() => formRef.current?.reset());
  const remove = useDeleteMeasurement();
  useConfettiBurst(celebrate);

  return (
    <div className='space-y-2.5'>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(
            { body: measurementInput(new FormData(e.currentTarget)) },
            { onSuccess: (result) => setCelebrate((done) => done || result.achievedGoals.length > 0) },
          );
        }}
        className='bg-card border-border flex flex-wrap items-end gap-3 rounded-xl border p-4'>
        <div className='min-w-28 flex-1 space-y-1.5'>
          <Label htmlFor='weightKg'>Weight (kg)</Label>
          <Input
            id='weightKg'
            name='weightKg'
            type='number'
            inputMode='decimal'
            step='0.1'
            min={30}
            max={300}
            placeholder='72.5'
          />
        </div>
        <div className='min-w-28 flex-1 space-y-1.5'>
          <Label htmlFor='bodyFatPct'>Body fat (%)</Label>
          <Input
            id='bodyFatPct'
            name='bodyFatPct'
            type='number'
            inputMode='decimal'
            step='0.1'
            min={3}
            max={60}
            placeholder='18'
          />
        </div>
        <Button type='submit' variant='brand' disabled={add.isPending}>
          {add.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
          Log
        </Button>
      </form>

      {measurements.length === 0 ? (
        <div className='border-border rounded-xl border border-dashed p-5 text-center'>
          <Scale className='text-muted-foreground mx-auto mb-1.5 size-5' aria-hidden />
          <p className='text-foreground text-sm font-medium'>No measurements yet</p>
          <p className='text-muted-foreground text-xs'>
            Log your weight or body fat to track progress toward your goals.
          </p>
        </div>
      ) : (
        <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
          {measurements.map((m) => (
            <div key={m.id} className='flex items-center justify-between gap-3 py-3'>
              <div className='min-w-0'>
                <p className='text-foreground text-sm font-medium'>{measurementLine(m)}</p>
                <p className='text-muted-foreground text-xs'>{measurementDateLabel(m.measuredAt)}</p>
              </div>
              <button
                type='button'
                aria-label='Delete measurement'
                disabled={remove.isPending}
                onClick={() => remove.mutate({ params: { path: { id: m.id } } })}
                className='text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex size-6 items-center justify-center rounded-md transition-colors disabled:opacity-50'>
                <X className='size-3.5' aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
