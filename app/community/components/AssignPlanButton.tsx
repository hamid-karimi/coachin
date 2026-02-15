"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  assignCoachWeeklyPlanAction,
  type CommunityActionState,
} from "../actions";

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
      <button
        type='submit'
        disabled={pending}
        className='rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs disabled:opacity-60'>
        {pending ? "Sending..." : "Assign plan"}
      </button>
    </form>
  );
}
