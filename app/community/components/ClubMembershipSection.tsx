"use client";

import { useActionState } from "react";
import { Star, UsersRound } from "lucide-react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { ConfirmButton } from "@/components/design-system/confirm-button";
import { EmptyState } from "@/components/design-system/empty-state";
import type { ClubMembershipSummary } from "../types";
import {
  type CommunityActionState,
  createClubAction,
  joinClubByInviteAction,
  leaveClubAction,
  setPrimaryClubAction,
} from "../actions";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-bold'>Club Memberships</CardTitle>
        <CardDescription>
          You can join multiple clubs and choose one as your primary club.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        <form action={createAction} className='space-y-2'>
          <Label htmlFor='club-name' className='text-muted-foreground'>
            Create a new club
          </Label>
          <div className='grid gap-2 md:grid-cols-3'>
            <Input
              id='club-name'
              name='club_name'
              type='text'
              required
              minLength={3}
              placeholder='Club name'
            />
            <Input
              name='club_description'
              type='text'
              placeholder='Short description (optional)'
            />
            <Button type='submit' disabled={creating}>
              {creating ? "Creating..." : "Create club"}
            </Button>
          </div>
        </form>

        <form action={joinAction} className='space-y-2'>
          <Label htmlFor='club-invite-code' className='text-muted-foreground'>
            Join with club invite code
          </Label>
          <div className='flex gap-2'>
            <Input
              id='club-invite-code'
              name='club_invite_code'
              type='text'
              required
              placeholder='Example: CLUB-ABC'
            />
            <Button type='submit' variant='secondary' disabled={pending}>
              {pending ? "Joining..." : "Join"}
            </Button>
          </div>
        </form>

        {memberships.length === 0 ? (
          <EmptyState
            icon={<UsersRound />}
            title='No clubs yet'
            description='Create a club or join one with an invite code to compete on the club leaderboard.'
          />
        ) : (
          <ul className='space-y-2'>
            {memberships.map((membership) => (
              <li
                key={membership.club_id}
                className='flex items-center justify-between gap-3 rounded-xl bg-secondary p-3'>
                <div className='min-w-0'>
                  <p className='flex items-center gap-2 truncate text-sm font-semibold text-foreground'>
                    {membership.is_primary && (
                      <Star
                        className='size-4 shrink-0 fill-brand text-brand'
                        aria-hidden
                      />
                    )}
                    {membership.club_name}
                  </p>
                  <p className='text-xs text-muted-foreground'>
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
                      <Button type='submit' size='sm' variant='secondary'>
                        Set Primary
                      </Button>
                    </form>
                  ) : (
                    <Badge variant='brand'>
                      <Star className='fill-current' aria-hidden />
                      Primary
                    </Badge>
                  )}

                  <ConfirmButton
                    size='sm'
                    variant='destructive'
                    title={`Leave ${membership.club_name}?`}
                    description="You'll drop off this club's leaderboard. You can rejoin later with the invite code."
                    confirmLabel='Leave club'
                    onConfirm={() => {
                      const formData = new FormData();
                      formData.set("club_id", membership.club_id);
                      leaveAction(formData);
                    }}>
                    Leave
                  </ConfirmButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
