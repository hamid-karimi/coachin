"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toGrams, type FoodUnit } from "@/lib/food-units";
import { pickedSummary, type PickedFood } from "../lib/meal-logger";
import { foodToReviewItem, type ReviewItem } from "../lib/photo-review";
import { FoodSearchField } from "./food-search-field";
import { UnitSelect } from "./unit-select";

/** Search a food, size it, and add it to the photo review. */
export function AddReviewItem({
  usdaEnabled,
  onAdd,
  onCancel,
}: {
  usdaEnabled: boolean;
  onAdd: (item: ReviewItem) => void;
  onCancel: () => void;
}) {
  const [food, setFood] = useState<PickedFood | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<FoodUnit>("g");
  const grams = toGrams(Number(amount), unit);

  if (!food) {
    return (
      <div className='space-y-2'>
        <FoodSearchField usdaEnabled={usdaEnabled} onPick={setFood} />
        <button type='button' onClick={onCancel} className='text-muted-foreground hover:text-foreground text-xs'>
          Cancel
        </button>
      </div>
    );
  }
  return (
    <div className='flex flex-wrap items-end gap-2'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{food.food.name}</p>
        <p className='text-muted-foreground text-xs'>{pickedSummary(food, grams)}</p>
      </div>
      <Input
        type='number'
        min={0.1}
        step='any'
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        aria-label='Amount'
        className='h-9 w-20'
      />
      <UnitSelect value={unit} onChange={setUnit} className='h-9' />
      <Button
        type='button'
        size='sm'
        variant='brand'
        disabled={grams <= 0}
        onClick={() => onAdd(foodToReviewItem(food, grams))}>
        <Plus aria-hidden />
        Add
      </Button>
      <button
        type='button'
        aria-label='Clear'
        onClick={() => setFood(null)}
        className='text-muted-foreground hover:text-foreground grid size-8 place-items-center'>
        <X className='size-4' aria-hidden />
      </button>
    </div>
  );
}
