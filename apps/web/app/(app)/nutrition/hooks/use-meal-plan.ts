"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { $api } from "@/lib/api/browser";

/** Everything a meal plan change shows up in: the plan, the calorie goal, Today's menu, the calendar. */
const PLAN_KEYS = [
  ["get", "/nutrition/plan"],
  ["get", "/nutrition/day"],
  ["get", "/today"],
  ["get", "/calendar"],
];

export function useMealPlan() {
  return $api.useSuspenseQuery("get", "/nutrition/plan").data;
}

export function useGenerateMealPlan() {
  return $api.useMutation("post", "/nutrition/plan", useMutationFeedback(PLAN_KEYS));
}

export function useRegenerateMealPlan() {
  return $api.useMutation("post", "/nutrition/plan/regenerate", useMutationFeedback(PLAN_KEYS));
}

export function useDiscardMealPlan() {
  return $api.useMutation("delete", "/nutrition/plan", useMutationFeedback(PLAN_KEYS));
}
