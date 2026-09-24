"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { UserPlus, UserMinus } from "lucide-react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  type CommunityActionState,
  followUserAction,
  unfollowUserAction,
} from "../actions";
import { Button } from "@/components/ui/button";

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
      <Button
        type='submit'
        size='sm'
        variant={isFollowing ? "secondary" : "brand"}
        disabled={pending}>
        {isFollowing ? (
          <UserMinus aria-hidden />
        ) : (
          <UserPlus aria-hidden />
        )}
        {pending ? "..." : isFollowing ? "Unfollow" : "Follow"}
      </Button>
    </form>
  );
}
