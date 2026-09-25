"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

export function useCoachingHub() {
  return $api.useSuspenseQuery("get", "/coaching").data;
}

export function useSportTypes() {
  return $api.useSuspenseQuery("get", "/sport-types").data;
}

export function useGenerateInviteCode() {
  return $api.useMutation("post", "/coaching/invite-codes", useMutationFeedback([["get", "/coaching"]]));
}

export function useAssignWeeklyPlan(onDone?: () => void) {
  return $api.useMutation(
    "post",
    "/coaching/trainees/{id}/weekly-plan",
    useMutationFeedback([["get", "/coaching"]], onDone),
  );
}
