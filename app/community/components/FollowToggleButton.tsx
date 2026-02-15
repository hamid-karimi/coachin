"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  type CommunityActionState,
  followUserAction,
  unfollowUserAction,
} from "../actions";

const initialState: CommunityActionState = {};

interface FollowToggleButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  onSuccess?: () => void;
}

export function FollowToggleButton({
  targetUserId,
  isFollowing,
  onSuccess,
}: FollowToggleButtonProps) {
  const action = isFollowing ? unfollowUserAction : followUserAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  useActionToast(state);

  useEffect(() => {
    if (state.success) {
      onSuccess?.();
    }
  }, [state.success, onSuccess]);

  return (
    <form action={formAction}>
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
    </form>
  );
}
