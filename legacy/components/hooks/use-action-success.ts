"use client";

import { useEffect, useRef } from "react";

type ActionSuccessState = { success?: boolean };

/**
 * Fires `onSuccess` once per successful server-action submission. Keyed on the
 * state object's identity (same trick as `useActionToast`): `useActionState`
 * returns a NEW object per submission but the SAME reference across unrelated
 * re-renders, so this never double-fires.
 */
export function useActionSuccess(
  state: ActionSuccessState,
  onSuccess?: () => void,
) {
  const lastStateRef = useRef<ActionSuccessState | null>(null);

  useEffect(() => {
    if (!state || state === lastStateRef.current) return;
    lastStateRef.current = state;
    if (state.success) onSuccess?.();
  }, [state, onSuccess]);
}
