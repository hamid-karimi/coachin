"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

const TODAY_KEY = ["get", "/today"] as const;

export function useAddSupplement(onDone?: () => void) {
  return $api.useMutation("post", "/supplements", useMutationFeedback([[...TODAY_KEY]], onDone));
}

export function useRescheduleSupplement(onDone?: () => void) {
  return $api.useMutation("put", "/supplements/{id}/schedule", useMutationFeedback([[...TODAY_KEY]], onDone));
}

export function useRemoveSupplement() {
  return $api.useMutation("delete", "/supplements/{id}", useMutationFeedback([[...TODAY_KEY]]));
}

/** Taken toggle; the item renders the pending value optimistically. */
export function useSetSupplementTaken() {
  return $api.useMutation("put", "/supplements/{id}/taken", useMutationFeedback([[...TODAY_KEY]]));
}
