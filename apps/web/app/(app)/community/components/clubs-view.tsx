"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClubs, useLeaveClub, useSetPrimaryClub } from "../hooks/use-community";
import type { ClubMembership } from "../lib/community";
import { ClubForms } from "./club-forms";

/** The user's clubs (primary drives the My Club board), plus create / join. */
export function ClubsView() {
  const clubs = useClubs();
  const setPrimary = useSetPrimaryClub();
  const [leaving, setLeaving] = useState<ClubMembership | null>(null);
  const leave = useLeaveClub(() => setLeaving(null));

  return (
    <div className='space-y-4'>
      <section className='bg-card border-border space-y-3 rounded-xl border p-4'>
        <h2 className='text-[15px] font-bold'>My clubs</h2>
        {clubs.length === 0 ? (
          <p className='text-muted-foreground text-sm'>
            You&apos;re not in a club yet — create one or join with an invite code.
          </p>
        ) : (
          <ul className='space-y-2'>
            {clubs.map((club) => (
              <li
                key={club.clubId}
                className='bg-secondary flex flex-wrap items-center justify-between gap-3 rounded-lg p-3'>
                <div className='min-w-0'>
                  <p className='text-foreground flex items-center gap-2 text-sm font-semibold'>
                    {club.name}
                    {club.isPrimary && <Badge variant='brand'>Primary</Badge>}
                    {club.role === "owner" && <Badge variant='outline'>Owner</Badge>}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Invite code:{" "}
                    <span className='text-foreground font-mono font-bold select-all'>{club.inviteCode}</span>
                  </p>
                </div>
                <div className='flex gap-1.5'>
                  {!club.isPrimary && (
                    <Button
                      type='button'
                      size='sm'
                      variant='secondary'
                      disabled={setPrimary.isPending}
                      onClick={() => setPrimary.mutate({ params: { path: { id: club.clubId } } })}>
                      <Star aria-hidden />
                      Make primary
                    </Button>
                  )}
                  <Button type='button' size='sm' variant='destructive-outline' onClick={() => setLeaving(club)}>
                    Leave
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ClubForms />
      <ConfirmDialog
        open={leaving !== null}
        title={leaving ? `Leave ${leaving.name}?` : ""}
        description='You can rejoin later with the invite code.'
        confirmLabel='Leave club'
        pending={leave.isPending}
        onCancel={() => setLeaving(null)}
        onConfirm={() => leaving && leave.mutate({ params: { path: { id: leaving.clubId } } })}
      />
    </div>
  );
}
