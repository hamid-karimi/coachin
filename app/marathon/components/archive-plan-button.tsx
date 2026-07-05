"use client";

import { useState, useActionState } from "react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";
import { archivePlanAction, type MarathonActionState } from "../actions";

const initialState: MarathonActionState = {};

export function ArchivePlanButton({ planId }: { planId: string }) {
  const [state, formAction, pending] = useActionState(
    archivePlanAction,
    initialState,
  );
  useActionToast(state);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive-outline"
        onClick={() => setOpen(true)}
      >
        Archive plan
      </Button>
      <ConfirmDialog
        open={open}
        title="Archive this plan?"
        description="Progress is kept, but the plan stops showing on your dashboard. You can generate a new one anytime."
        confirmLabel="Archive"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          const formData = new FormData();
          formData.set("plan_id", planId);
          formAction(formData);
          setOpen(false);
        }}
      />
    </>
  );
}
