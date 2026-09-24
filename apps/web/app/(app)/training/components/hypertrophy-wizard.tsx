"use client";

import { useState } from "react";
import { Dumbbell, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateHypertrophyPlan } from "../hooks/use-generate-plan";
import { HYPERTROPHY_OPTIONS, INITIAL_HYPERTROPHY_DRAFT, type HypertrophyDraft } from "../lib/hypertrophy-wizard";
import { ProfileCard } from "./profile-card";
import { Field, SELECT_CLASS, WizardCard } from "./wizard-fields";

interface HypertrophyWizardProps {
  profileSummary: string;
  hasBodyProfile: boolean;
  /** Coach mode: generate for this trainee (re-verified by the API). */
  targetStudentId?: string;
}

type SelectField = keyof typeof HYPERTROPHY_OPTIONS;

const SELECTS: { field: SelectField; label: string }[] = [
  { field: "goal", label: "Goal" },
  { field: "experienceLevel", label: "Training experience" },
  { field: "equipment", label: "Equipment" },
  { field: "daysPerWeek", label: "Training days / week" },
  { field: "weeksTotal", label: "Plan length" },
];

const NUMERIC: Record<SelectField, boolean> = {
  goal: false,
  experienceLevel: false,
  equipment: false,
  daysPerWeek: true,
  weeksTotal: true,
};

/** One-screen strength intake: goal, experience, equipment, frequency, length. */
export function HypertrophyWizard({ profileSummary, hasBodyProfile, targetStudentId }: HypertrophyWizardProps) {
  const [draft, setDraft] = useState<HypertrophyDraft>(INITIAL_HYPERTROPHY_DRAFT);
  const generate = useGenerateHypertrophyPlan();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        generate.mutate({ body: { ...draft, targetStudentId } });
      }}
      className='space-y-4'>
      <ProfileCard
        summary={profileSummary}
        complete={hasBodyProfile}
        icon={Dumbbell}
        extraHint='Consented body-photo analysis is used too, when available.'
      />
      <WizardCard>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          {SELECTS.map(({ field, label }) => (
            <Field key={field} id={field} label={label}>
              <select
                id={field}
                value={String(draft[field])}
                onChange={(e) =>
                  setDraft({ ...draft, [field]: NUMERIC[field] ? Number(e.target.value) : e.target.value })
                }
                className={SELECT_CLASS}>
                {HYPERTROPHY_OPTIONS[field].map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <Field id='injuries' label='Injuries or limitations (optional)'>
          <Textarea
            id='injuries'
            rows={2}
            maxLength={500}
            placeholder='Example: lower-back issues — avoid heavy deadlifts'
            value={draft.injuries}
            onChange={(e) => setDraft({ ...draft, injuries: e.target.value })}
          />
        </Field>
      </WizardCard>
      <div className='flex justify-end'>
        <Button type='submit' variant='brand' disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Sparkles aria-hidden />}
          {generate.isPending ? "Generating your plan…" : "Generate my plan"}
        </Button>
      </div>
    </form>
  );
}
