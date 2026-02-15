"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import type { ClubMembershipSummary } from "../types";
import {
  type CommunityActionState,
  createClubAction,
  joinClubByInviteAction,
  leaveClubAction,
  setPrimaryClubAction,
} from "../actions";

const initialState: CommunityActionState = {};

interface ClubMembershipSectionProps {
  memberships: ClubMembershipSummary[];
}

export function ClubMembershipSection({
  memberships,
}: ClubMembershipSectionProps) {
  const [createState, createAction, creating] = useActionState(
    createClubAction,
    initialState,
  );
  const [state, joinAction, pending] = useActionState(
    joinClubByInviteAction,
    initialState,
  );
  const [setPrimaryState, setPrimaryAction] = useActionState(
    setPrimaryClubAction,
    initialState,
  );
  const [leaveState, leaveAction] = useActionState(
    leaveClubAction,
    initialState,
  );

  useActionToast(createState);
  useActionToast(state);
  useActionToast(setPrimaryState);
  useActionToast(leaveState);

  return (
    <section className='bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm space-y-4'>
      <header className='space-y-1'>
        <h2 className='text-lg font-bold text-slate-900 dark:text-white'>
          Club Memberships
        </h2>
        <p className='text-xs text-slate-500 dark:text-slate-400'>
          You can join multiple clubs and choose one as your primary club.
        </p>
      </header>

      <form action={createAction} className='space-y-3'>
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          Create a new club
        </label>
        <div className='grid gap-2 md:grid-cols-3'>
          <input
            name='club_name'
            type='text'
            required
            minLength={3}
            placeholder='Club name'
            className='md:col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          />
          <input
            name='club_description'
            type='text'
            placeholder='Short description (optional)'
            className='md:col-span-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          />
          <button
            type='submit'
            disabled={creating}
            className='md:col-span-1 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm disabled:opacity-60'>
            {creating ? "Creating..." : "Create club"}
          </button>
        </div>
      </form>

      <form action={joinAction} className='space-y-3'>
        <label className='text-xs text-slate-500 dark:text-slate-400 block'>
          Join with club invite code
        </label>
        <div className='flex gap-2'>
          <input
            name='club_invite_code'
            type='text'
            required
            placeholder='Example: CLUB-ABC'
            className='flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm'
          />
          <button
            type='submit'
            disabled={pending}
            className='rounded-lg bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-60'>
            {pending ? "Joining..." : "Join"}
          </button>
        </div>
      </form>

      {memberships.length === 0 ? (
        <p className='text-sm text-slate-500 dark:text-slate-400'>
          You do not have any club memberships yet.
        </p>
      ) : (
        <ul className='space-y-2'>
          {memberships.map((membership) => (
            <li
              key={membership.club_id}
              className='rounded-xl bg-slate-50 dark:bg-slate-800 p-3 flex items-center justify-between gap-3'>
              <div>
                <p className='text-sm font-semibold text-slate-900 dark:text-white'>
                  {membership.club_name}
                </p>
                <p className='text-xs text-slate-500 dark:text-slate-400'>
                  Invite code: {membership.club_invite_code}
                </p>
              </div>

              <div className='flex items-center gap-2'>
                {!membership.is_primary ? (
                  <form action={setPrimaryAction}>
                    <input
                      type='hidden'
                      name='club_id'
                      value={membership.club_id}
                    />
                    <button
                      type='submit'
                      className='rounded-lg bg-amber-500 text-white px-3 py-1.5 text-xs'>
                      Set Primary
                    </button>
                  </form>
                ) : (
                  <span className='text-xs rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-1'>
                    Primary
                  </span>
                )}

                <form action={leaveAction}>
                  <input
                    type='hidden'
                    name='club_id'
                    value={membership.club_id}
                  />
                  <button
                    type='submit'
                    className='rounded-lg bg-rose-600 text-white px-3 py-1.5 text-xs'>
                    Leave
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
