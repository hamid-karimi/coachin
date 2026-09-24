"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

/** Query key of GET /routine (matches `$api` and the server prefetch). */
export const ROUTINE_KEY = ["get", "/routine"] as const;

/** The "My week" data, hydrated from the server prefetch. */
export function useRoutine() {
  return $api.useSuspenseQuery("get", "/routine").data;
}

export function useSportTypes() {
  return $api.useSuspenseQuery("get", "/sport-types").data;
}

export function useAddSchedules(onDone?: () => void) {
  return $api.useMutation("post", "/routine/schedules", useMutationFeedback([ROUTINE_KEY], onDone));
}

export function useDeleteSchedule() {
  return $api.useMutation("delete", "/routine/schedules/{id}", useMutationFeedback([ROUTINE_KEY]));
}

export function useSaveQuota(onDone?: () => void) {
  return $api.useMutation("put", "/routine/quotas/{sportTypeId}", useMutationFeedback([ROUTINE_KEY], onDone));
}

export function useDeleteQuota() {
  return $api.useMutation("delete", "/routine/quotas/{sportTypeId}", useMutationFeedback([ROUTINE_KEY]));
}
