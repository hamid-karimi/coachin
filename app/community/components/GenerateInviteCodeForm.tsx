"use client";

import { useActionState } from "react";
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

  return (
    <div className='space-y-4'>
      <form action={formAction} className='space-y-3'>
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          ساخت کد دعوت برای رشته
        </label>

        <div className='flex gap-2'>
          <select
            name='sport_type_id'
            className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
            required>
            <option value=''>انتخاب رشته ورزشی</option>
            {sportTypes.map((sport) => (
              <option key={sport.id ?? "unknown"} value={sport.id ?? ""}>
                {sport.name ?? "رشته"}
              </option>
            ))}
          </select>

          <button
            type='submit'
            disabled={pending}
            className='rounded-lg bg-green-600 text-white px-4 py-2 text-sm disabled:opacity-60'>
            {pending ? "در حال ساخت..." : "ساخت کد"}
          </button>
        </div>

        {state.error && (
          <p className='text-xs text-red-600 dark:text-red-400'>
            {state.error}
          </p>
        )}

        {state.success && state.message && (
          <p className='text-xs text-emerald-600 dark:text-emerald-400'>
            {state.message}
          </p>
        )}
      </form>

      <div className='space-y-2'>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          کدهای دعوت فعلی شما
        </p>
        {inviteCodes.length === 0 ? (
          <p className='text-xs text-slate-400 dark:text-slate-500'>
            هنوز کدی ساخته نشده است.
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
                    {invite.sport_type?.name ?? "بدون رشته"}
                  </p>
                </div>
                <span className='text-xs text-emerald-700 dark:text-emerald-400'>
                  {invite.is_active ? "فعال" : "غیرفعال"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
