import type { components } from "@/lib/api/schema";
import type { PickedFood } from "./meal-logger";
import type { MealType } from "./nutrition";

type EstimateItem = components["schemas"]["EstimateItemBody"];
export type ConfirmBody = components["schemas"]["ConfirmPhotoMealInputBody"];

/** A review row: an AI estimate (editable) or a food added from search. */
export type ReviewItem = EstimateItem & { source: "photo" | "search" };

export type ReviewAction =
  | { type: "estimate"; items: EstimateItem[] }
  | { type: "update"; index: number; patch: Partial<ReviewItem> }
  | { type: "append"; item: ReviewItem }
  | { type: "remove"; index: number }
  | { type: "discard" };

/** null while no estimate is under review. */
export type ReviewState = ReviewItem[] | null;

const HANDLERS: {
  [T in ReviewAction["type"]]: (s: ReviewState, a: Extract<ReviewAction, { type: T }>) => ReviewState;
} = {
  estimate: (_, { items }) => items.map((item) => ({ ...item, source: "photo" })),
  update: (state, { index, patch }) => state?.map((item, i) => (i === index ? { ...item, ...patch } : item)) ?? state,
  append: (state, { item }) => [...(state ?? []), item],
  remove: (state, { index }) => state?.filter((_, i) => i !== index) ?? state,
  discard: () => null,
};

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  return HANDLERS[action.type](state, action as never);
}

/** The review's total kcal (blank fields count 0). */
export function reviewTotal(items: ReviewItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.estKcal) || 0), 0);
}

/** A searched food at an amount as a review row (whole numbers, as the legacy review). */
export function foodToReviewItem(picked: PickedFood, grams: number): ReviewItem {
  const per100g = picked.food.per100g;
  const scaled = (value: number) => Math.round((value ?? 0) * (grams / 100));
  return {
    name: picked.food.name,
    estQuantityG: Math.round(grams),
    estKcal: scaled(per100g.kcal),
    proteinG: scaled(per100g.proteinG),
    carbsG: scaled(per100g.carbsG),
    fatG: scaled(per100g.fatG),
    sugarG: scaled(per100g.sugarG),
    fiberG: scaled(per100g.fiberG),
    sodiumMg: scaled(per100g.sodiumMg),
    source: "search",
  };
}

/** "Save 2 items" */
export function saveLabel(count: number): string {
  return `Save ${count} ${count === 1 ? "item" : "items"}`;
}

export function confirmBody(mealType: MealType, items: ReviewItem[]): ConfirmBody {
  return { mealType, items };
}

/** The multipart upload: every photo under "photos", plus the optional hint. */
export function photoForm(photos: File[], hint: string): FormData {
  const form = new FormData();
  for (const photo of photos) form.append("photos", photo);
  form.set("context", hint.trim());
  return form;
}
