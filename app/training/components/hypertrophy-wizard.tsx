"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Dumbbell, Loader2, Sparkles } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  generateHypertrophyPlanAction,
  type TrainingActionState,
} from "../actions";

const initialState: TrainingActionState = {};

const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]";

interface HypertrophyWizardProps {
  profileSummary: string;
  hasBodyProfile: boolean;
  /** Coach mode: generate the plan for this trainee (relationship is
   *  re-verified server-side in the action AND the RPC). */
  targetStudentId?: string;
}

export function HypertrophyWizard({
  profileSummary,
  hasBodyProfile,
  targetStudentId,
}: HypertrophyWizardProps) {
  const [state, formAction, generating] = useActionState(
    generateHypertrophyPlanAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-4">
      {targetStudentId && (
        <input type="hidden" name="target_student_id" value={targetStudentId} />
      )}
      <div className="bg-card border-border space-y-3 rounded-xl border p-4">
        <p className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <Dumbbell className="text-brand size-4" aria-hidden />
          We&apos;ll personalize with your profile
        </p>
        <p className="text-muted-foreground text-sm">{profileSummary}</p>
        {!hasBodyProfile && (
          <p className="text-flame-ink text-xs">
            Your body profile is incomplete —{" "}
            <Link href="/profile" className="underline">
              fill it in
            </Link>{" "}
            for a better plan (age, sex, height, weight). Consented body-photo
            analysis is used too, when available.
          </p>
        )}
      </div>

      <div className="bg-card border-border space-y-4 rounded-xl border p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="goal">Goal</Label>
            <select id="goal" name="goal" defaultValue="muscle_gain" className={selectClassName}>
              <option value="muscle_gain">Build muscle</option>
              <option value="recomp">Recomposition (muscle up, fat down)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="experience_level">Training experience</Label>
            <select
              id="experience_level"
              name="experience_level"
              defaultValue="recreational"
              className={selectClassName}
            >
              <option value="new">New to lifting</option>
              <option value="recreational">Some experience</option>
              <option value="regular">Consistent for 1+ years</option>
              <option value="competitive">Advanced</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="equipment">Equipment</Label>
            <select id="equipment" name="equipment" defaultValue="gym" className={selectClassName}>
              <option value="gym">Full gym</option>
              <option value="home">Home (dumbbells/bands)</option>
              <option value="bodyweight">Bodyweight only</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="days_per_week">Training days / week</Label>
            <select
              id="days_per_week"
              name="days_per_week"
              defaultValue="3"
              className={selectClassName}
            >
              {[2, 3, 4, 5, 6].map((days) => (
                <option key={days} value={days}>
                  {days}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weeks_total">Plan length</Label>
            <select
              id="weeks_total"
              name="weeks_total"
              defaultValue="10"
              className={selectClassName}
            >
              <option value="8">8 weeks</option>
              <option value="10">10 weeks</option>
              <option value="12">12 weeks</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="injuries">Injuries or limitations (optional)</Label>
          <textarea
            id="injuries"
            name="injuries"
            rows={2}
            maxLength={500}
            placeholder="Example: lower-back issues — avoid heavy deadlifts"
            className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="brand" disabled={generating}>
          {generating ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Sparkles aria-hidden />
          )}
          {generating ? "Generating your plan…" : "Generate my plan"}
        </Button>
      </div>
    </form>
  );
}
