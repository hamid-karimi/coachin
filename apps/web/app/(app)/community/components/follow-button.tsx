"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFollow, useUnfollow } from "../hooks/use-community";

/** Follow / Following toggle. */
export function FollowButton({ userId, following }: { userId: string; following: boolean }) {
  const follow = useFollow();
  const unfollow = useUnfollow();
  const busy = follow.isPending || unfollow.isPending;
  return following ? (
    <Button
      type='button'
      size='sm'
      variant='secondary'
      disabled={busy}
      onClick={() => unfollow.mutate({ params: { path: { id: userId } } })}>
      <UserCheck aria-hidden />
      Following
    </Button>
  ) : (
    <Button type='button' size='sm' variant='brand' disabled={busy} onClick={() => follow.mutate({ body: { userId } })}>
      <UserPlus aria-hidden />
      Follow
    </Button>
  );
}
