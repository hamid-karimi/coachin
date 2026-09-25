"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api/schema";
import { useAddMeasurement } from "../hooks/use-profile";
import { measurementInput } from "../lib/profile";

type ReportMetrics = components["schemas"]["ReportMetricsBody"];

/** Extracted report values, editable, saved only when the user confirms. */
export function ReportMetricsForm({ metrics, onSaved }: { metrics: ReportMetrics; onSaved: () => void }) {
  const save = useAddMeasurement(onSaved);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ body: measurementInput(new FormData(e.currentTarget)) });
      }}
      className='bg-brand-tint border-brand/30 flex flex-wrap items-end gap-3 rounded-xl border p-4'>
      <div className='min-w-24 flex-1 space-y-1.5'>
        <Label htmlFor='report-weight'>Weight (kg)</Label>
        <Input
          id='report-weight'
          name='weightKg'
          type='number'
          step='0.1'
          min={30}
          max={300}
          defaultValue={metrics.weightKg ?? ""}
        />
      </div>
      <div className='min-w-24 flex-1 space-y-1.5'>
        <Label htmlFor='report-bf'>Body fat (%)</Label>
        <Input
          id='report-bf'
          name='bodyFatPct'
          type='number'
          step='0.1'
          min={3}
          max={60}
          defaultValue={metrics.bodyFatPct ?? ""}
        />
      </div>
      <Button type='submit' variant='brand' disabled={save.isPending}>
        {save.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
        Save as measurement
      </Button>
      {metrics.notes ? <p className='text-muted-foreground w-full text-xs'>{metrics.notes}</p> : null}
    </form>
  );
}
