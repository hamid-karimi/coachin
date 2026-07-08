"use client";

import { ChevronLeft } from "lucide-react";
import { SportChip } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import { AddFixedSessionForm } from "./AddFixedSessionForm";
import { AddWeeklyTargetForm } from "./AddWeeklyTargetForm";
import {
  COMMITMENT_TYPES,
  CommitmentTypeSwitch,
  type CommitmentType,
} from "./CommitmentTypeSwitch";

interface CommitmentDetailsStepProps {
  sportId: string;
  sportName: string;
  type: CommitmentType;
  onTypeChange: (value: CommitmentType) => void;
  /** Returns to the sport step, keeping the current pick highlighted. */
  onBack: () => void;
  /** Days (0-6) that already have a fixed session, for the day-strip dots. */
  plannedDays: number[];
  /** Bubbles up from the forms after a successful save (closes the sheet). */
  onSuccess: () => void;
}

/**
 * Step 2 of the add-commitment sheet: the picked sport (tap to change) plus
 * the fixed-session / weekly-target switch and the matching form. One form
 * visible at a time keeps the sheet calm.
 */
export function CommitmentDetailsStep({
  sportId,
  sportName,
  type,
  onTypeChange,
  onBack,
  plannedDays,
  onSuccess,
}: CommitmentDetailsStepProps) {
  const activeType =
    COMMITMENT_TYPES.find((entry) => entry.value === type) ??
    COMMITMENT_TYPES[0];

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
        <AddFixedSessionForm
          sportId={sportId}
          plannedDays={plannedDays}
          onSuccess={onSuccess}
        />
      ) : (
        <AddWeeklyTargetForm sportId={sportId} onSuccess={onSuccess} />
      )}
    </div>
  );
}
