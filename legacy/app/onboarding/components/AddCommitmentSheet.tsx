"use client";

import { useReducer } from "react";
import { Plus } from "lucide-react";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CommitmentDetailsStep } from "./CommitmentDetailsStep";
import type { CommitmentType } from "./CommitmentTypeSwitch";
import { SportPicker, type SportOption } from "./SportPicker";

type Step = "sport" | "details";

interface SheetState {
  open: boolean;
  step: Step;
  sportId: string;
  commitmentType: CommitmentType;
}

type SheetAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "pick_sport"; sportId: string }
  | { type: "back" }
  | { type: "set_commitment_type"; value: CommitmentType };

const INITIAL_STATE: SheetState = {
  open: false,
  step: "sport",
  sportId: "",
  commitmentType: "fixed",
};

function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case "open":
      // Fresh flow every time — no stale picks from the last add.
      return { ...INITIAL_STATE, open: true };
    case "close":
      return { ...state, open: false };
    case "pick_sport":
      // Tapping the active chip clears it and stays on step 1.
      return action.sportId === ""
        ? { ...state, sportId: "" }
        : { ...state, sportId: action.sportId, step: "details" };
    case "back":
      return { ...state, step: "sport" };
    case "set_commitment_type":
      return { ...state, commitmentType: action.value };
  }
}

const STEP_DESCRIPTIONS: Record<Step, string> = {
  sport: "Step 1 of 2 — pick the sport you're committing to.",
  details: "Step 2 of 2 — a fixed day or a weekly target.",
};

interface AddCommitmentSheetProps {
  sports: SportOption[];
  /** Days (0-6) that already have a fixed session, for the day-strip dots. */
  plannedDays: number[];
}

/**
 * "Add to my week" trigger + the stepwise bottom sheet it opens: pick a sport
 * first, then fill in the commitment details. Picking a chip advances the
 * step, so there's never a dead button waiting on a hidden selection. A
 * successful save closes the sheet (the toast confirms it).
 */
export function AddCommitmentSheet({
  sports,
  plannedDays,
}: AddCommitmentSheetProps) {
  const [state, dispatch] = useReducer(sheetReducer, INITIAL_STATE);

  const pickedSport = sports.find(
    (sport) => String(sport.id) === state.sportId,
  );

  return (
    <>
      <Button
        type='button'
        variant='brand'
        className='w-full'
        onClick={() => dispatch({ type: "open" })}>
        <Plus aria-hidden /> Add to my week
      </Button>

      <BottomSheet
        open={state.open}
        onClose={() => dispatch({ type: "close" })}
        title={state.step === "sport" ? "What sport?" : "Add to my week"}
        description={STEP_DESCRIPTIONS[state.step]}>
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
            onTypeChange={(value) =>
              dispatch({ type: "set_commitment_type", value })
            }
            onBack={() => dispatch({ type: "back" })}
            plannedDays={plannedDays}
            onSuccess={() => dispatch({ type: "close" })}
          />
        )}
      </BottomSheet>
    </>
  );
}
