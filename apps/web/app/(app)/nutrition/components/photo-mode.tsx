"use client";

import { useReducer } from "react";
import { useConfirmPhotoMeal, useEstimatePhoto } from "../hooks/use-nutrition";
import { confirmBody, reviewReducer } from "../lib/photo-review";
import type { MealType } from "../lib/nutrition";
import { PhotoCapture } from "./photo-capture";
import { PhotoReview } from "./photo-review";

/** Photo logging: capture → AI estimate → review → save. */
export function PhotoMode({ mealType, usdaEnabled }: { mealType: MealType; usdaEnabled: boolean }) {
  const [items, dispatch] = useReducer(reviewReducer, null);
  const estimate = useEstimatePhoto();
  const confirm = useConfirmPhotoMeal(() => dispatch({ type: "discard" }));

  if (!items) {
    return (
      <PhotoCapture
        busy={estimate.isPending}
        onPhotos={(photos, hint) =>
          estimate.estimate(photos, hint, {
            onSuccess: (data) => data && dispatch({ type: "estimate", items: data.items }),
          })
        }
      />
    );
  }
  return (
    <PhotoReview
      items={items}
      usdaEnabled={usdaEnabled}
      saving={confirm.isPending}
      dispatch={dispatch}
      onSave={() => confirm.mutate({ body: confirmBody(mealType, items) })}
    />
  );
}
