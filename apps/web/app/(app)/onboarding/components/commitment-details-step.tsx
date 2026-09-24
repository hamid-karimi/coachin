"use client";

import { ChevronLeft } from "lucide-react";
import { SportChip } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import type { CommitmentType } from "../lib/commitments";
import { AddFixedSessionForm } from "./add-fixed-session-form";
import { AddWeeklyTargetForm } from "./add-weekly-target-form";
import { COMMITMENT_TYPES, CommitmentTypeSwitch } from "./commitment-type-switch";

interface CommitmentDetailsStepProps {
  sportId: number | null;
  sportName: string;
  type: CommitmentType;
  onTypeChange: (value: CommitmentType) => void;
  /** Returns to the sport step, keeping the current pick highlighted. */
  onBack: () => void;
  plannedDays: number[];
  /** After a successful save (closes the sheet). */
  onSuccess: () => void;
}

/** Step 2: the picked sport (tap to change), the type switch, and its form. */
export function CommitmentDetailsStep({
  sportId,
  sportName,
  type,
  onTypeChange,
  onBack,
  plannedDays,
  onSuccess,
}: CommitmentDetailsStepProps) {
  const activeType = COMMITMENT_TYPES.find((entry) => entry.value === type) ?? COMMITMENT_TYPES[0];

  return (
    <div className='flex flex-col gap-4'>
      <button
        type='button'
        onClick={onBack}
        className='text-muted-foreground hover:text-foreground flex items-center gap-1.5 self-start text-sm transition-colors'>
        <ChevronLeft className='size-4' aria-hidden />
        <SportChip sport={sportFromName(sportName)} label={sportName} selected />
        <span>Change</span>
      </button>

      <CommitmentTypeSwitch value={type} onChange={onTypeChange} />
      <p className='text-muted-foreground text-xs'>{activeType.hint}</p>

      {type === "fixed" ? (
        <AddFixedSessionForm sportId={sportId} plannedDays={plannedDays} onSuccess={onSuccess} />
      ) : (
        <AddWeeklyTargetForm sportId={sportId} onSuccess={onSuccess} />
      )}
    </div>
  );
}
