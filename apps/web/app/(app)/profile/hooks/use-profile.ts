"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

export function useProfileOverview() {
  return $api.useSuspenseQuery("get", "/me/overview").data;
}

export function useGoals() {
  return $api.useSuspenseQuery("get", "/goals").data;
}

export function useProfileProgress() {
  return $api.useSuspenseQuery("get", "/me/progress").data;
}

export function useBodyProfile() {
  return $api.useSuspenseQuery("get", "/me/body").data;
}

/** Goals feed the profile and Today's goal strip. */
const GOAL_KEYS = [["get", "/goals"]];
/** A measurement moves the charts, the snapshot, goals, and (on a goal payout) XP. */
const MEASUREMENT_KEYS = [
  ["get", "/me/progress"],
  ["get", "/me/body"],
  ["get", "/goals"],
  ["get", "/today"],
  ["get", "/me/overview"],
];

export function useSaveBodyProfile() {
  return $api.useMutation("put", "/me/body", useMutationFeedback([["get", "/me/body"]]));
}

export function useNutritionSharing() {
  return $api.useMutation("put", "/me/nutrition-sharing", useMutationFeedback([["get", "/me/body"]]));
}

export function useAddMeasurement(onDone?: () => void) {
  return $api.useMutation("post", "/measurements", useMutationFeedback(MEASUREMENT_KEYS, onDone));
}

export function useDeleteMeasurement() {
  return $api.useMutation("delete", "/measurements/{id}", useMutationFeedback(MEASUREMENT_KEYS));
}

export function useCreateGoal(onDone?: () => void) {
  return $api.useMutation("post", "/goals", useMutationFeedback(GOAL_KEYS, onDone));
}

export function useAbandonGoal() {
  return $api.useMutation("post", "/goals/{id}/abandon", useMutationFeedback(GOAL_KEYS));
}

/** Imported runs are completed workouts: Today, the calendar, My week, and the overview move. */
export function useImportActivities(onDone?: () => void) {
  return $api.useMutation(
    "post",
    "/activities/import",
    useMutationFeedback(
      [
        ["get", "/today"],
        ["get", "/calendar"],
        ["get", "/routine"],
        ["get", "/me/overview"],
      ],
      onDone,
    ),
  );
}
