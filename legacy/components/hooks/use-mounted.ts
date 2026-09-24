"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * `false` during SSR/hydration, `true` after mount — without the
 * setState-in-effect pattern (no cascading re-render, lint-clean).
 * Use for client-only UI state like the resolved theme.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
