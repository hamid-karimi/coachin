"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  type CommunityActionState,
  generateCoachInviteCodeAction,
} from "../actions";
import type { CoachInviteCodeSummary, SportTypeSummary } from "../types";

const initialState: CommunityActionState = {};

interface GenerateInviteCodeFormProps {
  sportTypes: SportTypeSummary[];
  inviteCodes: CoachInviteCodeSummary[];
}

export function GenerateInviteCodeForm({
  sportTypes,
  inviteCodes,
}: GenerateInviteCodeFormProps) {
  const [state, formAction, pending] = useActionState(
    generateCoachInviteCodeAction,
    initialState,
  );
  useActionToast(state);

  return (
    <div className='space-y-4'>
      <form action={formAction} className='space-y-3'>
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          Generate invite code for sport
        </label>

        <div className='flex gap-2'>
          <select
            name='sport_type_id'
            className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
            required>
            <option value=''>Select sport type</option>
            {sportTypes.map((sport) => (
              <option key={sport.id ?? "unknown"} value={sport.id ?? ""}>
                {sport.name ?? "Sport"}
              </option>
            ))}
          </select>

          <button
            type='submit'
            disabled={pending}
            className='rounded-lg bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-60'>
            {pending ? "Generating..." : "Generate code"}
          </button>
        </div>
      </form>

      <div className='space-y-2'>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          Your current invite codes
        </p>
        {inviteCodes.length === 0 ? (
          <p className='text-xs text-slate-400 dark:text-slate-500'>
            No invite codes yet.
          </p>
        ) : (
          <ul className='space-y-2'>
            {inviteCodes.map((invite) => (
              <li
                key={invite.code}
                className='rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm flex items-center justify-between gap-3'>
                <div>
                  <p className='font-mono text-slate-900 dark:text-white'>
                    {invite.code}
                  </p>
                  <p className='text-xs text-slate-500 dark:text-slate-400'>
                    {invite.sport_type?.name ?? "No sport"}
                  </p>
                </div>
                <span className='text-xs text-emerald-700 dark:text-emerald-400'>
                  {invite.is_active ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
