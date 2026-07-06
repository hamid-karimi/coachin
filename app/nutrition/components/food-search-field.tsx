"use client";

import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FoodResult } from "../api/foods/route";

/**
 * Debounced food autocomplete: local `foods` table on every keystroke, explicit
 * USDA fallback on request. Owns its own query/results state and reports a
 * pick via `onPick`. Reused by search mode, manual entry, and the photo-review
 * "add item" flow so every add path is searchable.
 */
export function FoodSearchField({
  onPick,
  hasUsda = false,
  placeholder = "Search foods — e.g. chicken breast",
  autoFocus = false,
}: {
  onPick: (food: FoodResult) => void;
  hasUsda?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const sequenceRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
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
  }, [query]);

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

  const pick = (food: FoodResult) => {
    onPick(food);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          // Clear stale matches here (not in the effect) to avoid a
          // synchronous setState-in-effect on every short query.
          if (next.trim().length < 2) setResults([]);
        }}
        placeholder={placeholder}
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {searching && <p className="text-muted-foreground text-xs">Searching…</p>}
      {results.length > 0 && (
        <ul className="border-border divide-border divide-y rounded-lg border">
          {results.map((food, index) => (
            <li key={food.id ?? `usda-${index}`}>
              <button
                type="button"
                onClick={() => pick(food)}
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
        <Button type="button" size="sm" variant="outline" onClick={searchUsda}>
          <Globe aria-hidden />
          Search USDA database
        </Button>
      )}
    </div>
  );
}
