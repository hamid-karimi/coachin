"use client";

import { useReducer } from "react";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useRoutine, useSportTypes } from "../hooks/use-routine";
import { INITIAL_SHEET, plannedDays, sheetReducer, type SheetStep } from "../lib/commitments";
import { CommitmentDetailsStep } from "./commitment-details-step";
import { SportPicker } from "./sport-picker";

const STEP_COPY: Record<SheetStep, { title: string; description: string }> = {
  sport: { title: "What sport?", description: "Step 1 of 2 — pick the sport you're committing to." },
  details: { title: "Add to my week", description: "Step 2 of 2 — a fixed day or a weekly target." },
};

/**
 * "Add to my week" trigger + the stepwise sheet it opens: pick a sport, then
 * the commitment details. A successful save closes the sheet (the toast
 * confirms it).
 */
export function AddCommitmentSheet() {
  const sports = useSportTypes();
  const { schedules } = useRoutine();
  const [state, dispatch] = useReducer(sheetReducer, INITIAL_SHEET);
  const pickedSport = sports.find((sport) => sport.id === state.sportId);
  const copy = STEP_COPY[state.step];

  return (
    <section className='mb-6'>
      <Button type='button' variant='brand' className='w-full' onClick={() => dispatch({ type: "open" })}>
        <Plus aria-hidden /> Add to my week
      </Button>

      <BottomSheet
        open={state.open}
        onClose={() => dispatch({ type: "close" })}
        title={copy.title}
        description={copy.description}>
        {state.step === "sport" ? (
          <SportPicker
            sports={sports}
            value={state.sportId}
            onChange={(sportId) => dispatch({ type: "pick_sport", sportId })}
          />
        ) : (
          <CommitmentDetailsStep
            sportId={state.sportId}
            sportName={pickedSport?.name ?? ""}
            type={state.commitmentType}
            onTypeChange={(value) => dispatch({ type: "set_commitment_type", value })}
            onBack={() => dispatch({ type: "back" })}
            plannedDays={plannedDays(schedules)}
            onSuccess={() => dispatch({ type: "close" })}
          />
        )}
      </BottomSheet>
    </section>
  );
}
