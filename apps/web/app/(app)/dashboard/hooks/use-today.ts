"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

/** The Today data, hydrated from the server prefetch. */
export function useToday() {
  return $api.useSuspenseQuery("get", "/today").data;
}

/** Log a routine workout; refetches Today and My week (target progress). */
export function useLogWorkout() {
  return $api.useMutation(
    "post",
    "/today/workouts",
    useMutationFeedback([
      ["get", "/today"],
      ["get", "/routine"],
    ]),
  );
}
