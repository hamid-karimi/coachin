"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useArchivePlan } from "../hooks/use-programs";

export function ArchivePlanButton({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const archive = useArchivePlan();

  return (
    <>
      <Button type='button' size='sm' variant='outline' onClick={() => setOpen(true)}>
        Archive plan
      </Button>
      <ConfirmDialog
        open={open}
        title='Archive this plan?'
        description='Progress is kept, but the plan stops showing on your dashboard. You can generate a new one anytime.'
        confirmLabel='Archive'
        confirmVariant='success'
        pending={archive.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          archive.mutate({ params: { path: { id: planId } } });
          setOpen(false);
        }}
      />
    </>
  );
}
