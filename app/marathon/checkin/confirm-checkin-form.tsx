"use client";

import { useActionState } from "react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { applyCheckinAction, type MarathonActionState } from "../actions";

const initialState: MarathonActionState = {};

/** The ONE mutation path of the check-in: hidden payload + confirm button. */
export function ConfirmCheckinForm({
  planId,
  checkinWeek,
  targetWeek,
  decision,
  summary,
  scorecardJson,
  itemsJson,
}: {
  planId: string;
  checkinWeek: number;
  targetWeek: number;
  decision: string;
  summary: string;
  scorecardJson: string;
  itemsJson: string;
}) {
  const [state, formAction, pending] = useActionState(
    applyCheckinAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="checkin_week" value={checkinWeek} />
      <input type="hidden" name="target_week" value={targetWeek} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="summary" value={summary} />
      <input type="hidden" name="scorecard_json" value={scorecardJson} />
      <input type="hidden" name="items_json" value={itemsJson} />
      <Button type="submit" variant="brand" size="lg" disabled={pending}>
        {pending
          ? "Applying…"
          : `Confirm — update week ${targetWeek} (+20 XP)`}
      </Button>
    </form>
  );
}
