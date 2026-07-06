"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Camera,
  Loader2,
  PencilLine,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { compressImage } from "@/lib/client-image";
import { toGrams, type FoodUnit } from "@/lib/food-units";
import type { MealEstimateItem } from "@/lib/ai/nutrition";
import type { FoodResult } from "../api/foods/route";
import {
  confirmPhotoMealsAction,
  estimateMealPhotoAction,
  logMealAction,
  type NutritionActionState,
} from "../actions";
import { FoodSearchField } from "./food-search-field";
import { UnitSelect } from "./unit-select";

const initialState: NutritionActionState = {};

const MEAL_TYPES = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
] as const;

type Mode = "search" | "manual" | "photo";

/** Scale a per-100g food into a review item at the given gram amount. */
function foodToReviewItem(food: FoodResult, grams: number): MealEstimateItem {
  const factor = grams / 100;
  return {
    name: food.name,
    est_quantity_g: Math.round(grams),
    est_kcal: Math.round(food.kcal_per_100g * factor),
    protein_g: Math.round((food.protein_g ?? 0) * factor),
    carbs_g: Math.round((food.carbs_g ?? 0) * factor),
    fat_g: Math.round((food.fat_g ?? 0) * factor),
    sugar_g: Math.round((food.sugar_g ?? 0) * factor),
    fiber_g: Math.round((food.fiber_g ?? 0) * factor),
    sodium_mg: Math.round((food.sodium_mg ?? 0) * factor),
  };
}

export function MealLogger({ hasUsda }: { hasUsda: boolean }) {
  const [mode, setMode] = useState<Mode>("search");
  const [mealType, setMealType] = useState<string>("lunch");

  const [logState, logAction, logging] = useActionState(
    logMealAction,
    initialState,
  );
  const [estimateState, estimateAction, estimating] = useActionState(
    estimateMealPhotoAction,
    initialState,
  );
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmPhotoMealsAction,
    initialState,
  );
  useActionToast(logState);
  useActionToast(estimateState);
  useActionToast(confirmState);

  // --- search mode state ---
  const [picked, setPicked] = useState<FoodResult | null>(null);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState<FoodUnit>("g");
  const grams = toGrams(amount, unit);

  // Clear picked food after a successful log.
  const lastLogRef = useRef<NutritionActionState>(initialState);
  useEffect(() => {
    if (logState !== lastLogRef.current && logState.success) {
      setPicked(null);
      setAmount(100);
      setUnit("g");
    }
    lastLogRef.current = logState;
  }, [logState]);

  // --- photo mode state ---
  // Compression happens in a plain async handler; the action dispatch must
  // be synchronous inside startTransition (dispatching after an `await`
  // loses the transition context and isPending breaks).
  const [isPreparing, setIsPreparing] = useState(false);
  const [, startDispatch] = useTransition();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [reviewItems, setReviewItems] = useState<MealEstimateItem[] | null>(
    null,
  );

  // Adjust-during-render (not an effect): when a new estimate arrives from
  // the action, open the review sheet with it.
  const [seenEstimate, setSeenEstimate] = useState<
    MealEstimateItem[] | undefined
  >(undefined);
  if (estimateState.estimate && estimateState.estimate !== seenEstimate) {
    setSeenEstimate(estimateState.estimate);
    setReviewItems(estimateState.estimate);
  }

  const lastConfirmRef = useRef<NutritionActionState>(initialState);
  useEffect(() => {
    if (confirmState !== lastConfirmRef.current && confirmState.success) {
      setReviewItems(null);
    }
    lastConfirmRef.current = confirmState;
  }, [confirmState]);

  const onPhotoPicked = async (list: FileList | null) => {
    const file = list?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!file) return;
    setIsPreparing(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.set("photo", compressed);
      startDispatch(() => estimateAction(formData));
    } catch {
      toast.error("Could not read that image");
    } finally {
      setIsPreparing(false);
    }
  };

  const updateReviewItem = (
    index: number,
    patch: Partial<MealEstimateItem>,
  ) => {
    setReviewItems((current) =>
      current
        ? current.map((item, i) => (i === index ? { ...item, ...patch } : item))
        : current,
    );
  };

  const appendReviewItem = (item: MealEstimateItem) =>
    setReviewItems((current) => [...(current ?? []), item]);

  const busy = logging || estimating || confirming || isPreparing;

  return (
    <div className="bg-card border-border space-y-4 rounded-xl border p-4">
      {/* Meal type + mode */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {MEAL_TYPES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMealType(value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                mealType === value
                  ? "bg-brand text-brand-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["search", Search, "Search"],
              ["photo", Camera, "Photo"],
              ["manual", PencilLine, "Manual"],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                mode === value
                  ? "bg-brand-tint text-brand-ink"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH MODE */}
      {mode === "search" && (
        <div className="space-y-3">
          {!picked ? (
            <FoodSearchField onPick={setPicked} hasUsda={hasUsda} />
          ) : (
            <form action={logAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="meal_type" value={mealType} />
              {picked.id ? (
                <input type="hidden" name="food_id" value={picked.id} />
              ) : (
                <input
                  type="hidden"
                  name="usda_json"
                  value={JSON.stringify(picked)}
                />
              )}
              <input type="hidden" name="quantity_g" value={grams} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{picked.name}</p>
                <p className="text-muted-foreground text-xs">
                  {Math.round(picked.kcal_per_100g)} kcal/100g · {grams}g
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id="amount"
                    type="number"
                    min={0.1}
                    step="any"
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    className="w-24"
                    required
                  />
                  <UnitSelect value={unit} onChange={setUnit} />
                </div>
              </div>
              <Button type="submit" variant="brand" disabled={busy || grams <= 0}>
                {logging ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                Log
              </Button>
              <button
                type="button"
                aria-label="Clear selection"
                onClick={() => setPicked(null)}
                className="text-muted-foreground hover:text-foreground grid size-8 place-items-center"
              >
                <X className="size-4" aria-hidden />
              </button>
            </form>
          )}
        </div>
      )}

      {/* MANUAL MODE */}
      {mode === "manual" && (
        <form action={logAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="meal_type" value={mealType} />
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="manual_name">Food</Label>
            <Input
              id="manual_name"
              name="manual_name"
              placeholder="Homemade soup"
              required
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="manual_kcal">kcal</Label>
            <Input
              id="manual_kcal"
              name="manual_kcal"
              type="number"
              min={1}
              max={5000}
              required
            />
          </div>
          <div className="w-20 space-y-1.5">
            <Label htmlFor="manual_protein">Protein</Label>
            <Input
              id="manual_protein"
              name="manual_protein"
              type="number"
              min={0}
              placeholder="0"
            />
          </div>
          <Button type="submit" variant="brand" disabled={busy}>
            {logging ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Plus aria-hidden />
            )}
            Log
          </Button>
        </form>
      )}

      {/* PHOTO MODE */}
      {mode === "photo" && (
        <div className="space-y-3">
          {!reviewItems ? (
            <div className="space-y-2">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                onChange={(event) => onPhotoPicked(event.target.files)}
              />
              <Button
                type="button"
                variant="brand"
                disabled={busy}
                onClick={() => photoInputRef.current?.click()}
              >
                {estimating || isPreparing ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : (
                  <Camera aria-hidden />
                )}
                {estimating || isPreparing
                  ? "Estimating…"
                  : "Snap or choose a meal photo"}
              </Button>
              <p className="text-muted-foreground text-xs">
                AI estimates portions and calories — you review and adjust
                everything before it&apos;s saved.
              </p>
            </div>
          ) : (
            <ReviewForm
              mealType={mealType}
              items={reviewItems}
              hasUsda={hasUsda}
              busy={busy}
              confirming={confirming}
              confirmAction={confirmAction}
              onUpdate={updateReviewItem}
              onAppend={appendReviewItem}
              onRemove={(index) =>
                setReviewItems((current) =>
                  current ? current.filter((_, i) => i !== index) : current,
                )
              }
              onDiscard={() => setReviewItems(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Photo-estimate review + edit, with searchable add-item. */
function ReviewForm({
  mealType,
  items,
  hasUsda,
  busy,
  confirming,
  confirmAction,
  onUpdate,
  onAppend,
  onRemove,
  onDiscard,
}: {
  mealType: string;
  items: MealEstimateItem[];
  hasUsda: boolean;
  busy: boolean;
  confirming: boolean;
  confirmAction: (formData: FormData) => void;
  onUpdate: (index: number, patch: Partial<MealEstimateItem>) => void;
  onAppend: (item: MealEstimateItem) => void;
  onRemove: (index: number) => void;
  onDiscard: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <form action={confirmAction} className="space-y-3">
      <input type="hidden" name="meal_type" value={mealType} />
      <input type="hidden" name="items_json" value={JSON.stringify(items)} />
      <div className="border-border divide-border divide-y rounded-lg border">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 px-3 py-2"
          >
            <Input
              value={item.name}
              placeholder="Food name"
              onChange={(event) => onUpdate(index, { name: event.target.value })}
              className="h-9 min-w-32 flex-1 text-sm font-medium"
            />
            <label className="text-muted-foreground flex items-center gap-1 text-xs">
              <Input
                type="number"
                min={1}
                value={item.est_quantity_g}
                onChange={(event) =>
                  onUpdate(index, {
                    est_quantity_g: Number(event.target.value),
                  })
                }
                className="h-9 w-20 min-w-16 text-right"
              />
              g
            </label>
            <label className="text-muted-foreground flex items-center gap-1 text-xs">
              <Input
                type="number"
                min={0}
                max={5000}
                value={item.est_kcal}
                onChange={(event) =>
                  onUpdate(index, { est_kcal: Number(event.target.value) })
                }
                className="h-9 w-20 min-w-16 text-right"
              />
              kcal
            </label>
            <button
              type="button"
              aria-label={`Remove ${item.name || "item"}`}
              onClick={() => onRemove(index)}
              className="text-muted-foreground hover:text-foreground grid size-7 place-items-center"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}

        {/* Searchable add-item */}
        <div className="space-y-2 px-3 py-2">
          {adding ? (
            <AddItemSearch
              hasUsda={hasUsda}
              onAdd={(item) => {
                onAppend(item);
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="text-brand-ink inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                <Plus className="size-3.5" aria-hidden />
                Add item
              </button>
              <span className="text-foreground text-sm font-semibold">
                Total{" "}
                {items.reduce(
                  (sum, item) => sum + (Number(item.est_kcal) || 0),
                  0,
                )}{" "}
                kcal
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="brand"
          disabled={busy || items.length === 0}
        >
          {confirming ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Plus aria-hidden />
          )}
          Save {items.length} {items.length === 1 ? "item" : "items"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDiscard}>
          Discard
        </Button>
      </div>
    </form>
  );
}

/** Search a food, choose an amount + unit, and append it as a review item. */
function AddItemSearch({
  hasUsda,
  onAdd,
  onCancel,
}: {
  hasUsda: boolean;
  onAdd: (item: MealEstimateItem) => void;
  onCancel: () => void;
}) {
  const [food, setFood] = useState<FoodResult | null>(null);
  const [amount, setAmount] = useState(100);
  const [unit, setUnit] = useState<FoodUnit>("g");
  const grams = toGrams(amount, unit);

  if (!food) {
    return (
      <div className="space-y-2">
        <FoodSearchField
          onPick={setFood}
          hasUsda={hasUsda}
          autoFocus
          placeholder="Search to add — e.g. olive oil"
        />
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{food.name}</p>
        <p className="text-muted-foreground text-xs">
          {Math.round(food.kcal_per_100g)} kcal/100g · {grams}g
        </p>
      </div>
      <Input
        type="number"
        min={0.1}
        step="any"
        value={amount}
        onChange={(event) => setAmount(Number(event.target.value))}
        aria-label="Amount"
        className="h-9 w-20"
      />
      <UnitSelect value={unit} onChange={setUnit} className="h-9" />
      <Button
        type="button"
        size="sm"
        variant="brand"
        disabled={grams <= 0}
        onClick={() => onAdd(foodToReviewItem(food, grams))}
      >
        <Plus aria-hidden />
        Add
      </Button>
      <button
        type="button"
        aria-label="Clear"
        onClick={() => setFood(null)}
        className="text-muted-foreground hover:text-foreground grid size-8 place-items-center"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
