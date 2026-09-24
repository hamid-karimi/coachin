"use client";

import { useReducer, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGenerateRunningPlan } from "../hooks/use-generate-plan";
import {
  INITIAL_RUNNING_DRAFT,
  planLabel,
  runningBody,
  runningDraftReducer,
  WIZARD_STEPS,
} from "../lib/running-wizard";
import { ProfileCard } from "./profile-card";
import { RunningBackgroundStep } from "./running-background-step";
import { RunningGoalStep } from "./running-goal-step";
import { WizardCard } from "./wizard-fields";

interface RunningWizardProps {
  profileSummary: string;
  hasBodyProfile: boolean;
  /** Coach mode: generate for this trainee (re-verified by the API). */
  targetStudentId?: string;
}

/** Four steps: about you → running background → goal → review + generate. */
export function RunningWizard({ profileSummary, hasBodyProfile, targetStudentId }: RunningWizardProps) {
  const [step, setStep] = useState(1);
  const [draft, dispatch] = useReducer(runningDraftReducer, INITIAL_RUNNING_DRAFT);
  const generate = useGenerateRunningPlan();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        generate.mutate({ body: runningBody(draft, targetStudentId) });
      }}
      className='space-y-4'>
      <div className='flex items-center justify-between'>
        <p className='text-brand-ink text-[13px] font-semibold'>
          Step {step} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step - 1]}
        </p>
        <div className='flex gap-1.5' aria-hidden>
          {WIZARD_STEPS.map((label, index) => (
            <span key={label} className={`h-1.5 w-8 rounded-full ${index < step ? "bg-brand" : "bg-secondary"}`} />
          ))}
        </div>
      </div>

      {step === 1 && <ProfileCard summary={profileSummary} complete={hasBodyProfile} />}
      {step === 2 && <RunningBackgroundStep draft={draft} dispatch={dispatch} />}
      {step === 3 && <RunningGoalStep draft={draft} dispatch={dispatch} />}
      {step === 4 && (
        <WizardCard>
          <p className='text-foreground text-sm font-semibold'>Ready to generate your {planLabel(draft)} plan</p>
          <p className='text-muted-foreground text-sm'>
            The plan uses your answers and PBs. Generation takes ~15 seconds and replaces any existing active running
            plan.
          </p>
        </WizardCard>
      )}

      <div className='flex items-center justify-between'>
        {step > 1 ? (
          <Button type='button' variant='ghost' onClick={() => setStep((s) => s - 1)} disabled={generate.isPending}>
            <ArrowLeft aria-hidden />
            Back
          </Button>
        ) : (
          <span />
        )}
        {/* Distinct keys: reusing one <button> would let the click that turns
            "Continue" into the submit button also submit the form. */}
        {step < WIZARD_STEPS.length ? (
          <Button key='continue' type='button' variant='brand' onClick={() => setStep((s) => s + 1)}>
            Continue
            <ArrowRight aria-hidden />
          </Button>
        ) : (
          <Button key='generate' type='submit' variant='brand' disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Sparkles aria-hidden />}
            {generate.isPending ? "Generating your plan…" : "Generate my plan"}
          </Button>
        )}
      </div>
    </form>
  );
}
