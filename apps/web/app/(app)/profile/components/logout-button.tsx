"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";
import { $api } from "@/lib/api/browser";

export function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const logout = $api.useMutation("post", "/auth/logout", {
    onSettled: () => {
      // Signed out either way: the cookie is cleared even when the session
      // was already gone, so never leave the viewer on a dead page.
      queryClient.clear();
      router.replace("/auth/login");
      router.refresh();
    },
  });

  return (
    <>
      <Button variant='destructive-outline' onClick={() => setConfirming(true)} disabled={logout.isPending}>
        <LogOut aria-hidden />
        {logout.isPending ? "Logging out…" : "Log out"}
      </Button>
      <ConfirmDialog
        open={confirming}
        title='Log out?'
        description='Your streak keeps counting — just come back tomorrow and log a session.'
        confirmLabel='Log out'
        pending={logout.isPending}
        onConfirm={() => {
          setConfirming(false);
          logout.mutate({});
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
