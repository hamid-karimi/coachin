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
  Globe,
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
import type { MealEstimateItem } from "@/lib/ai/nutrition";
import type { FoodResult } from "../api/foods/route";
import {
  confirmPhotoMealsAction,
  estimateMealPhotoAction,
  logMealAction,
  type NutritionActionState,
} from "../actions";

const initialState: NutritionActionState = {};

const MEAL_TYPES = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
] as const;

type Mode = "search" | "manual" | "photo";

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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<FoodResult | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || picked) {
      return;
    }
    const controller = new AbortController();
    const sequence = ++sequenceRef.current;
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const response = await fetch(
          `/nutrition/api/foods?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("search failed");
        const payload = (await response.json()) as { foods?: FoodResult[] };
        if (sequence === sequenceRef.current) {
          setResults(payload.foods ?? []);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          toast.error("Food search failed — try again");
        }
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query, picked]);

  const searchUsda = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    try {
      setSearching(true);
      const response = await fetch(
        `/nutrition/api/foods?q=${encodeURIComponent(trimmed)}&remote=1`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        foods?: FoodResult[];
        error?: string;
      };
      if (!response.ok) {
        toast.error(payload.error ?? "USDA search failed");
        return;
      }
      if (!payload.foods || payload.foods.length === 0) {
        toast.info("No USDA matches either — add it manually");
        return;
      }
      setResults(payload.foods);
    } finally {
      setSearching(false);
    }
  };

  // Clear picked food after a successful log.
  const lastLogRef = useRef<NutritionActionState>(initialState);
  useEffect(() => {
    if (logState !== lastLogRef.current && logState.success) {
      setPicked(null);
      setQuery("");
      setResults([]);
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
            <div className="space-y-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search foods — e.g. chicken breast"
                type="search"
                autoComplete="off"
              />
              {searching && (
                <p className="text-muted-foreground text-xs">Searching…</p>
              )}
              {results.length > 0 && (
                <ul className="border-border divide-border divide-y rounded-lg border">
                  {results.map((food, index) => (
                    <li key={food.id ?? `usda-${index}`}>
                      <button
                        type="button"
                        onClick={() => setPicked(food)}
                        className="hover:bg-secondary flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors"
                      >
                        <span className="min-w-0 truncate">{food.name}</span>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {Math.round(food.kcal_per_100g)} kcal/100g
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && !searching && hasUsda && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={searchUsda}
                >
                  <Globe aria-hidden />
                  Search USDA database
                </Button>
              )}
            </div>
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{picked.name}</p>
                <p className="text-muted-foreground text-xs">
                  {Math.round(picked.kcal_per_100g)} kcal/100g
                </p>
              </div>
              <div className="w-28 space-y-1.5">
                <Label htmlFor="quantity_g">Grams</Label>
                <Input
                  id="quantity_g"
                  name="quantity_g"
                  type="number"
                  min={1}
                  max={5000}
                  defaultValue={100}
                  required
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
            <form action={confirmAction} className="space-y-3">
              <input type="hidden" name="meal_type" value={mealType} />
              <input
                type="hidden"
                name="items_json"
                value={JSON.stringify(reviewItems)}
              />
              <div className="border-border divide-border divide-y rounded-lg border">
                {reviewItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-2 px-3 py-2"
                  >
                    <Input
                      value={item.name}
                      placeholder="Food name"
                      onChange={(event) =>
                        updateReviewItem(index, { name: event.target.value })
                      }
                      className="h-8 min-w-32 flex-1 text-sm font-medium"
                    />
                    <label className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Input
                        type="number"
                        min={1}
                        value={item.est_quantity_g}
                        onChange={(event) =>
                          updateReviewItem(index, {
                            est_quantity_g: Number(event.target.value),
                          })
                        }
                        className="h-8 w-16"
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
                          updateReviewItem(index, {
                            est_kcal: Number(event.target.value),
                          })
                        }
                        className="h-8 w-16"
                      />
                      kcal
                    </label>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name || "item"}`}
                      onClick={() =>
                        setReviewItems((current) =>
                          current
                            ? current.filter((_, i) => i !== index)
                            : current,
                        )
                      }
                      className="text-muted-foreground hover:text-foreground grid size-7 place-items-center"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2">
                  <button
                    type="button"
                    onClick={() =>
                      setReviewItems((current) => [
                        ...(current ?? []),
                        {
                          name: "",
                          est_quantity_g: 100,
                          est_kcal: 0,
                          protein_g: 0,
                          carbs_g: 0,
                          fat_g: 0,
                        },
                      ])
                    }
                    className="text-brand-ink inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add item
                  </button>
                  <span className="text-foreground text-sm font-semibold">
                    Total{" "}
                    {reviewItems.reduce(
                      (sum, item) => sum + (Number(item.est_kcal) || 0),
                      0,
                    )}{" "}
                    kcal
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="brand"
                  disabled={busy || reviewItems.length === 0}
                >
                  {confirming ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Plus aria-hidden />
                  )}
                  Save {reviewItems.length}{" "}
                  {reviewItems.length === 1 ? "item" : "items"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setReviewItems(null)}
                >
                  Discard
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
