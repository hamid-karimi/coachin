"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { problemMessage } from "@/lib/api/problem";
import { useFoodSearch, useUsdaSearch } from "../hooks/use-nutrition";
import type { PickedFood } from "../lib/meal-logger";

type Row = { key: string; name: string; kcal: number; pick: PickedFood };

/**
 * Food autocomplete: the local foods table as you type, USDA only when asked
 * (the shared key allows 1000 requests an hour).
 */
export function FoodSearchField({ onPick, usdaEnabled }: { onPick: (food: PickedFood) => void; usdaEnabled: boolean }) {
  const [text, setText] = useState("");
  const [usdaQuery, setUsdaQuery] = useState<string | null>(null);
  const local = useFoodSearch(text);
  const usda = useUsdaSearch(usdaQuery);
  const query = text.trim();
  const showUsda = usdaQuery !== null && usdaQuery === query;

  const rows: Row[] = showUsda
    ? (usda.data ?? []).map((food) => ({
        key: `usda-${food.fdcId}`,
        name: food.name,
        kcal: food.per100g.kcal,
        pick: { kind: "usda", food },
      }))
    : query.length >= 2
      ? (local.data ?? []).map((food) => ({
          key: food.id,
          name: food.name,
          kcal: food.per100g.kcal,
          pick: { kind: "local", food },
        }))
      : [];
  const searching = showUsda ? usda.isFetching : local.isFetching;

  const pick = (food: PickedFood) => {
    onPick(food);
    setText("");
    setUsdaQuery(null);
  };

  return (
    <div className='space-y-2'>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Search foods — e.g. chicken breast'
        type='search'
        autoComplete='off'
        aria-label='Search foods'
      />
      {searching && <p className='text-muted-foreground text-xs'>Searching…</p>}
      {rows.length > 0 && (
        <ul className='border-border divide-border divide-y rounded-lg border'>
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type='button'
                onClick={() => pick(row.pick)}
                className='hover:bg-secondary flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors'>
                <span className='min-w-0 truncate'>{row.name}</span>
                <span className='text-muted-foreground shrink-0 text-xs'>{Math.round(row.kcal)} kcal/100g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {showUsda && usda.isError && <p className='text-destructive text-xs'>{problemMessage(usda.error)}</p>}
      {showUsda && usda.isSuccess && rows.length === 0 && (
        <p className='text-muted-foreground text-xs'>No USDA matches either — add it manually</p>
      )}
      {usdaEnabled && query.length >= 2 && !searching && !showUsda && (
        <Button type='button' size='sm' variant='outline' onClick={() => setUsdaQuery(query)}>
          <Globe aria-hidden />
          Search USDA database
        </Button>
      )}
    </div>
  );
}
