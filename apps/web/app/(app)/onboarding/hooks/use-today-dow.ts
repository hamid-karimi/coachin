"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * Today's weekday (0=Sun … 6=Sat) in the viewer's timezone; null during SSR
 * and hydration so the server's clock never decides "today".
 */
export function useTodayDow(): number | null {
  return useSyncExternalStore(
    noSubscribe,
    () => new Date().getDay(),
    () => null,
  );
}
