"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateProfileAction,
  type ProfileActionState,
} from "../actions";

const initialState: ProfileActionState = {};

interface BodyMetricsFormProps {
  birthDate: string | null;
  sex: string | null;
  heightCm: number | null;
  trainingHistory: string | null;
  country: string | null;
}

/** Static body profile used by the AI program/diet intake (roadmap branch 1). */
export function BodyMetricsForm({
  birthDate,
  sex,
  heightCm,
  trainingHistory,
  country,
}: BodyMetricsFormProps) {
  const [state, formAction, pending] = useActionState(
    updateProfileAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form
      action={formAction}
      className="bg-card border-border space-y-4 rounded-xl border p-4"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="birth_date">Birth date</Label>
          <Input
            id="birth_date"
            name="birth_date"
            type="date"
            defaultValue={birthDate ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sex">Sex</Label>
          <select
            id="sex"
            name="sex"
            defaultValue={sex ?? ""}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
          >
            <option value="">Prefer not to say</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="height_cm">Height (cm)</Label>
          <Input
            id="height_cm"
            name="height_cm"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={100}
            max={250}
            placeholder="175"
            defaultValue={heightCm ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="country">Country</Label>
        <Input
          id="country"
          name="country"
          maxLength={56}
          placeholder="Iran"
          defaultValue={country ?? ""}
        />
        <p className="text-muted-foreground text-xs">
          Meal plans and food recognition prefer dishes and ingredients that
          are common and affordable where you live.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="training_history">Training history</Label>
        <textarea
          id="training_history"
          name="training_history"
          rows={3}
          maxLength={1000}
          placeholder="Example: running 3x/week for 2 years, one half marathon (1:55), knee injury in 2024."
          defaultValue={trainingHistory ?? ""}
          className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
        />
        <p className="text-muted-foreground text-xs">
          Used to personalize your training program and diet suggestions.
        </p>
      </div>

      <Button type="submit" variant="brand" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Save profile
      </Button>
    </form>
  );
}
