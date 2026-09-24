"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";

import { logoutAction } from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <>
      <Button
        variant="destructive-outline"
        onClick={() => setConfirming(true)}
        disabled={isPending}
      >
        <LogOut aria-hidden />
        {isPending ? "Logging out…" : "Log out"}
      </Button>

      <ConfirmDialog
        open={confirming}
        title="Log out?"
        description="Your streak keeps counting — just come back tomorrow and log a session."
        confirmLabel="Log out"
        pending={isPending}
        onConfirm={() => {
          setConfirming(false);
          handleLogout();
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
