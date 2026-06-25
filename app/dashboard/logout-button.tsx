"use client";

import { logoutAction } from "./actions";
import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <Button
      variant="outline"
      onClick={handleLogout}
      disabled={isPending}
    >
      <LogOut aria-hidden />
      {isPending ? "Logging out..." : "Logout"}
    </Button>
  );
}
