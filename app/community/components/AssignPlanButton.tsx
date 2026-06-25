"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  assignCoachWeeklyPlanAction,
  type CommunityActionState,
} from "../actions";
import { Button } from "@/components/ui/button";

const initialState: CommunityActionState = {};

interface AssignPlanButtonProps {
  studentId: string;
}

export function AssignPlanButton({ studentId }: AssignPlanButtonProps) {
  const [state, formAction, pending] = useActionState(
    assignCoachWeeklyPlanAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type='hidden' name='student_id' value={studentId} />
      <Button type='submit' size='sm' variant='secondary' disabled={pending}>
        {pending ? "Sending..." : "Assign plan"}
      </Button>
    </form>
  );
}
