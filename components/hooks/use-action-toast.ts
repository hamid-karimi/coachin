"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type ToastStatus = "success" | "info" | "error";

type ActionToastState = {
  error?: string;
  success?: boolean;
  message?: string;
  status?: ToastStatus;
};

export function useActionToast(state: ActionToastState) {
  // Key on the state object identity, not its text. `useActionState` returns a
  // NEW state object per submission but the SAME reference across unrelated
  // re-renders — so this fires once per submission (even two identical failures
  // in a row) without double-firing on re-render.
  const lastStateRef = useRef<ActionToastState | null>(null);

  useEffect(() => {
    if (!state || state === lastStateRef.current) {
      return;
    }
    lastStateRef.current = state;

    if (state.error) {
      toast.error(state.error);
      return;
    }

    if (!state.success || !state.message) {
      return;
    }

    const status = state.status ?? "success";

    if (status === "info") {
      toast.info(state.message);
      return;
    }

    toast.success(state.message);
  }, [state]);
}
