"use client";

import { useActionState, useState, useTransition } from "react";
import { Shield, Star } from "lucide-react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import type { ClubMembershipSummary } from "../types";
import {
  type CommunityActionState,
  createClubAction,
  joinClubByInviteAction,
  leaveClubAction,
  setPrimaryClubAction,
} from "../actions";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [leaveState, leaveAction, leaving] = useActionState(
    leaveClubAction,
    initialState,
  );

  // Destructive guard: leaving a club always confirms first.
  const [clubToLeave, setClubToLeave] =
    useState<ClubMembershipSummary | null>(null);
  const [, startTransition] = useTransition();

  useActionToast(createState);
  useActionToast(state);
  useActionToast(setPrimaryState);
  useActionToast(leaveState);

  const confirmLeave = () => {
    if (!clubToLeave) return;
    const formData = new FormData();
    formData.append("club_id", clubToLeave.club_id);
    startTransition(() => {
      leaveAction(formData);
    });
    setClubToLeave(null);
  };

  return (
    <section className='space-y-4'>
      <div>
        <h2 className='text-foreground text-[17px] font-bold'>Clubs</h2>
        <p className='text-muted-foreground mt-0.5 text-sm'>
          Join several — your primary club is the one that counts for the
          &ldquo;My Club&rdquo; board.
        </p>
      </div>

      {memberships.length === 0 ? (
        <div className='border-border flex flex-col items-center gap-2.5 rounded-xl border border-dashed px-5 py-8 text-center'>
          <span className='bg-secondary text-muted-foreground grid size-12 place-items-center rounded-full'>
            <Shield className='size-5' aria-hidden />
          </span>
          <p className='text-foreground font-semibold'>No club yet</p>
          <p className='text-muted-foreground max-w-75 text-sm leading-relaxed'>
            Join a club to compete on a smaller board with people you know.
          </p>
        </div>
      ) : (
        <ul className='space-y-2'>
          {memberships.map((membership) => (
            <li
              key={membership.club_id}
              className='bg-card border-border flex items-center gap-3 rounded-xl border p-3.5'>
              <span className='bg-xp-tint text-brand-ink grid size-11 shrink-0 place-items-center rounded-lg'>
                <Shield className='size-5' aria-hidden />
              </span>
              <div className='min-w-0 flex-1'>
                <p className='text-foreground flex items-center gap-1.5 truncate text-sm font-semibold'>
                  {membership.club_name}
                  {membership.is_primary && (
                    <Star
                      className='fill-tier-gold text-tier-gold size-3.5 shrink-0'
                      aria-label='Primary club'
                    />
                  )}
                </p>
                <p className='text-muted-foreground truncate text-xs'>
                  Code: {membership.club_invite_code}
                  {membership.is_primary &&
                    " · Primary — counts for the My Club board"}
                </p>
              </div>

              <div className='flex shrink-0 items-center gap-2'>
                {!membership.is_primary && (
                  <form action={setPrimaryAction}>
                    <input
                      type='hidden'
                      name='club_id'
                      value={membership.club_id}
                    />
                    <Button type='submit' size='sm' variant='secondary'>
                      Set primary
                    </Button>
                  </form>
                )}
                <Button
                  type='button'
                  size='sm'
                  variant='destructive-outline'
                  onClick={() => setClubToLeave(membership)}>
                  Leave
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className='grid gap-4 md:grid-cols-2'>
        <form
          action={joinAction}
          className='bg-card border-border space-y-2.5 rounded-xl border p-4'>
          <Label htmlFor='club-invite-code'>Join with a code</Label>
          <div className='flex gap-2'>
            <Input
              id='club-invite-code'
              name='club_invite_code'
              type='text'
              required
              placeholder='CLUB-ABC'
              className='font-mono uppercase'
            />
            <Button type='submit' variant='secondary' disabled={pending}>
              {pending ? "Joining…" : "Join"}
            </Button>
          </div>
        </form>

        <form
          action={createAction}
          className='bg-card border-border space-y-2.5 rounded-xl border p-4'>
          <Label htmlFor='club-name'>Create a club</Label>
          <div className='flex flex-col gap-2'>
            <Input
              id='club-name'
              name='club_name'
              type='text'
              required
              minLength={3}
              placeholder='Club name'
            />
            <div className='flex gap-2'>
              <Input
                name='club_description'
                type='text'
                placeholder='Short description (optional)'
              />
              <Button type='submit' variant='secondary' disabled={creating}>
                {creating ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={clubToLeave !== null}
        title={`Leave ${clubToLeave?.club_name ?? "this club"}?`}
        description="You'll drop off their leaderboard. Rejoin anytime with a code."
        confirmLabel='Leave club'
        pending={leaving}
        onConfirm={confirmLeave}
        onCancel={() => setClubToLeave(null)}
      />
    </section>
  );
}
