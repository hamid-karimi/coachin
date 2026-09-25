"use client";

import { useState } from "react";
import { CalendarCog } from "lucide-react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAssignWeeklyPlan } from "../hooks/use-coaching";

/** Copy the coach's weekly routine onto the trainee (after a confirm). */
export function AssignPlanButton({ traineeId, name }: { traineeId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const assign = useAssignWeeklyPlan(() => setConfirming(false));
  return (
    <>
      <Button type='button' size='sm' variant='secondary' onClick={() => setConfirming(true)}>
        <CalendarCog aria-hidden />
        Assign plan
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Replace ${name}'s weekly routine with yours?`}
        description='Their current routine is removed; your sessions become theirs.'
        confirmLabel='Assign plan'
        confirmVariant='brand'
        pending={assign.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          assign.mutate({ params: { path: { id: traineeId } } }, { onError: () => setConfirming(false) })
        }
      />
    </>
  );
}
