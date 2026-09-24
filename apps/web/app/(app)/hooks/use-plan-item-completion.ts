"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

/**
 * Queries that show plan-item completion or its XP; refetched after a toggle.
 * (Calendar and Training join this list when they are ported.)
 */
export const PLAN_PROGRESS_KEYS = [["get", "/today"]] as const;

/** Done/undo toggle for a plan item; the row renders the pending value optimistically. */
export function usePlanItemCompletion() {
  return $api.useMutation(
    "put",
    "/plan-items/{id}/completion",
    useMutationFeedback(PLAN_PROGRESS_KEYS.map((key) => [...key])),
  );
}
