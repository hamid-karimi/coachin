"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";
import { PLAN_PROGRESS_KEYS } from "./use-plan-item-completion";

/** "How did it go" log: marks the item done, +10 XP once, AI coach feedback. */
export function useSessionLog() {
  return $api.useMutation(
    "post",
    "/plan-items/{id}/session-log",
    useMutationFeedback(PLAN_PROGRESS_KEYS.map((key) => [...key])),
  );
}
