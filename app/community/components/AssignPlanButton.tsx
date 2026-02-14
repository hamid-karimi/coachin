"use client";

import { useActionState } from "react";
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

  return (
    <form action={formAction} className='flex flex-col items-end gap-1'>
      <input type='hidden' name='student_id' value={studentId} />
      <button
        type='submit'
        disabled={pending}
        className='rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs disabled:opacity-60'>
        {pending ? "در حال ارسال..." : "ارسال برنامه"}
      </button>
      {state.error && (
        <span className='text-[10px] text-rose-500'>{state.error}</span>
      )}
      {state.success && state.message && (
        <span className='text-[10px] text-emerald-500'>{state.message}</span>
      )}
    </form>
  );
}
