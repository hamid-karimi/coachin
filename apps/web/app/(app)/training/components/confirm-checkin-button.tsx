"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckinProposal } from "@/app/lib/checkin-data";
import { useConfirmCheckin } from "../hooks/use-confirm-checkin";
import { confirmBody } from "../lib/checkin";

/** The check-in's one mutation: apply the proposed week. */
export function ConfirmCheckinButton({ proposal }: { proposal: CheckinProposal }) {
  const confirm = useConfirmCheckin();
  // Stays disabled after success: the page is navigating away.
  const busy = confirm.isPending || confirm.isSuccess;
  return (
    <Button
      type='button'
      variant='brand'
      size='lg'
      disabled={busy}
      onClick={() =>
        confirm.mutate({
          params: { path: { id: proposal.planId } },
          body: confirmBody(proposal),
        })
      }>
      {busy && <Loader2 className='animate-spin' aria-hidden />}
      {busy ? "Applying…" : `Confirm — update week ${proposal.targetWeek} (+20 XP)`}
    </Button>
  );
}
