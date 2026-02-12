"use client";

import { useActionState } from "react";
import {
  type CommunityActionState,
  followUserAction,
  unfollowUserAction,
} from "../actions";

const initialState: CommunityActionState = {};

interface FollowToggleButtonProps {
  targetUserId: string;
  isFollowing: boolean;
}

export function FollowToggleButton({
  targetUserId,
  isFollowing,
}: FollowToggleButtonProps) {
  const action = isFollowing ? unfollowUserAction : followUserAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className='flex flex-col items-end gap-1'>
      <input type='hidden' name='following_id' value={targetUserId} />
      <button
        type='submit'
        disabled={pending}
        className={`text-xs px-2 py-1 rounded-md ${
          isFollowing
            ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            : "bg-indigo-600 text-white"
        } disabled:opacity-60`}>
        {pending ? "..." : isFollowing ? "Unfollow" : "Follow"}
      </button>
      {state.error && (
        <span className='text-[10px] text-rose-500'>{state.error}</span>
      )}
    </form>
  );
}
