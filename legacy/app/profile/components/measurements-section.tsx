"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Scale, X } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMeasurementAction,
  deleteMeasurementAction,
  type ProfileActionState,
} from "../actions";

const initialState: ProfileActionState = {};

export type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

function DeleteMeasurementButton({ measurementId }: { measurementId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteMeasurementAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="measurement_id" value={measurementId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Delete measurement"
        className="text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex size-6 items-center justify-center rounded-md transition-colors disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <X className="size-3.5" aria-hidden />
        )}
      </button>
    </form>
  );
}

interface MeasurementsSectionProps {
  measurements: Measurement[];
}

/** Weight / body-fat series: log form + recent history (roadmap branch 1). */
export function MeasurementsSection({ measurements }: MeasurementsSectionProps) {
  const [state, formAction, pending] = useActionState(
    addMeasurementAction,
    initialState,
  );
  useActionToast(state);

  // Goal achieved by this measurement → one celebratory burst
  // (dynamic import pattern copied from the dashboard workout card).
  const celebratedRef = useRef("");
  useEffect(() => {
    const key = state.achievedGoals?.join("|") ?? "";
    if (!key || celebratedRef.current === key) return;
    celebratedRef.current = key;
    import("canvas-confetti").then((mod) => {
      mod.default({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.7 },
        zIndex: 60,
      });
    });
  }, [state.achievedGoals]);

  return (
    <div className="space-y-2.5">
      <form
        action={formAction}
        className="bg-card border-border flex flex-wrap items-end gap-3 rounded-xl border p-4"
      >
        <div className="min-w-28 flex-1 space-y-1.5">
          <Label htmlFor="weight_kg">Weight (kg)</Label>
          <Input
            id="weight_kg"
            name="weight_kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={30}
            max={300}
            placeholder="72.5"
          />
        </div>
        <div className="min-w-28 flex-1 space-y-1.5">
          <Label htmlFor="body_fat_pct">Body fat (%)</Label>
          <Input
            id="body_fat_pct"
            name="body_fat_pct"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={3}
            max={60}
            placeholder="18"
          />
        </div>
        <Button type="submit" variant="brand" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Log
        </Button>
      </form>

      {measurements.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-5 text-center">
          <Scale
            className="text-muted-foreground mx-auto mb-1.5 size-5"
            aria-hidden
          />
          <p className="text-foreground text-sm font-medium">
            No measurements yet
          </p>
          <p className="text-muted-foreground text-xs">
            Log your weight or body fat to track progress toward your goals.
          </p>
        </div>
      ) : (
        <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
          {measurements.map((measurement) => (
            <div
              key={measurement.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">
                  {[
                    measurement.weight_kg !== null
                      ? `${measurement.weight_kg} kg`
                      : null,
                    measurement.body_fat_pct !== null
                      ? `${measurement.body_fat_pct}% body fat`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {new Date(
                    `${measurement.measured_at}T00:00:00`,
                  ).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <DeleteMeasurementButton measurementId={measurement.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
