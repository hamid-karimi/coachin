"use client";

import { useMutationFeedback } from "@/components/hooks/use-mutation-feedback";
import { useDebouncedValue } from "@/components/hooks/use-debounced-value";
import { $api } from "@/lib/api/browser";

/** Queries a meal changes: the nutrition page, and Today (XP). */
const MEAL_KEYS = [
  ["get", "/nutrition/day"],
  ["get", "/today"],
];

export function useNutritionDay() {
  return $api.useSuspenseQuery("get", "/nutrition/day").data;
}

export function useLogMeal(onDone?: () => void) {
  return $api.useMutation("post", "/meals", useMutationFeedback(MEAL_KEYS, onDone));
}

export function useDeleteMeal() {
  return $api.useMutation("delete", "/meals/{id}", useMutationFeedback(MEAL_KEYS));
}

/** Local food matches for the typed text (debounced; 2+ characters). */
export function useFoodSearch(text: string) {
  const q = useDebouncedValue(text.trim(), 250);
  return $api.useQuery("get", "/foods", { params: { query: { q } } }, { enabled: q.length >= 2 });
}

/** USDA matches, fetched only for the query the athlete asked for (null = none). */
export function useUsdaSearch(q: string | null) {
  return $api.useQuery(
    "get",
    "/foods/usda",
    { params: { query: { q: q ?? "" } } },
    { enabled: q !== null, retry: false },
  );
}
