"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

export function usePrograms() {
  return $api.useSuspenseQuery("get", "/training/programs").data;
}

/** Archive a plan; Today shows active plans too, so it refetches as well. */
export function useArchivePlan() {
  return $api.useMutation(
    "post",
    "/training/plans/{id}/archive",
    useMutationFeedback([
      ["get", "/training/programs"],
      ["get", "/today"],
      ["get", "/routine"],
    ]),
  );
}
