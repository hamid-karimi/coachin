"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  type CommunityActionState,
  connectCoachByCodeAction,
} from "../actions";

const initialState: CommunityActionState = {};

export function AddCoachByCodeForm() {
  const [state, formAction, pending] = useActionState(
    connectCoachByCodeAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction} className='space-y-3'>
      <label className='text-xs text-slate-500 dark:text-slate-400 block'>
        Coach invite code
      </label>
      <div className='flex gap-2'>
        <input
          type='text'
          name='invite_code'
          placeholder='Example: COACH-2-X7H9KD'
          className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          required
        />
        <button
          type='submit'
          disabled={pending}
          className='rounded-lg bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60'>
          {pending ? "Connecting..." : "Add coach"}
        </button>
      </div>
    </form>
  );
}
