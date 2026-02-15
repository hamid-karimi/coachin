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
  const lastToastKeyRef = useRef("");

  useEffect(() => {
    if (!state) {
      return;
    }

    if (state.error) {
      const key = `error:${state.error}`;

      if (lastToastKeyRef.current !== key) {
        lastToastKeyRef.current = key;
        toast.error(state.error);
      }

      return;
    }

    if (!state.success || !state.message) {
      return;
    }

    const status = state.status ?? "success";
    const key = `${status}:${state.message}`;

    if (lastToastKeyRef.current === key) {
      return;
    }

    lastToastKeyRef.current = key;

    if (status === "info") {
      toast.info(state.message);
      return;
    }

    toast.success(state.message);
  }, [state]);
}
