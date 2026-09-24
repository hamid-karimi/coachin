"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewTotal, saveLabel, type ReviewAction, type ReviewItem } from "../lib/photo-review";
import { AddReviewItem } from "./add-review-item";

interface PhotoReviewProps {
  items: ReviewItem[];
  usdaEnabled: boolean;
  saving: boolean;
  dispatch: (action: ReviewAction) => void;
  onSave: () => void;
}

/** Edit the AI's items (name, grams, kcal), add missed foods, then save — nothing is saved before this. */
export function PhotoReview({ items, usdaEnabled, saving, dispatch, onSave }: PhotoReviewProps) {
  const [adding, setAdding] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className='space-y-3'>
      <div className='border-border divide-border divide-y rounded-lg border'>
        {items.map((item, index) => (
          <div key={index} className='flex flex-wrap items-center gap-2 px-3 py-2'>
            <Input
              value={item.name}
              placeholder='Food name'
              aria-label={`Item ${index + 1} name`}
              onChange={(e) => dispatch({ type: "update", index, patch: { name: e.target.value } })}
              className='h-9 min-w-32 flex-1 text-sm font-medium'
            />
            <label className='text-muted-foreground flex items-center gap-1 text-xs'>
              <Input
                type='number'
                min={1}
                value={item.estQuantityG}
                aria-label={`Item ${index + 1} grams`}
                onChange={(e) => dispatch({ type: "update", index, patch: { estQuantityG: Number(e.target.value) } })}
                className='h-9 w-20 min-w-16 text-right'
              />
              g
            </label>
            <label className='text-muted-foreground flex items-center gap-1 text-xs'>
              <Input
                type='number'
                min={0}
                max={5000}
                value={item.estKcal}
                aria-label={`Item ${index + 1} kcal`}
                onChange={(e) => dispatch({ type: "update", index, patch: { estKcal: Number(e.target.value) } })}
                className='h-9 w-20 min-w-16 text-right'
              />
              kcal
            </label>
            <button
              type='button'
              aria-label={`Remove ${item.name || "item"}`}
              onClick={() => dispatch({ type: "remove", index })}
              className='text-muted-foreground hover:text-foreground grid size-7 place-items-center'>
              <X className='size-3.5' aria-hidden />
            </button>
          </div>
        ))}
        <div className='space-y-2 px-3 py-2'>
          {adding ? (
            <AddReviewItem
              usdaEnabled={usdaEnabled}
              onAdd={(item) => {
                dispatch({ type: "append", item });
                setAdding(false);
              }}
              onCancel={() => setAdding(false)}
            />
          ) : (
            <div className='flex items-center justify-between'>
              <button
                type='button'
                onClick={() => setAdding(true)}
                className='text-brand-ink inline-flex items-center gap-1 text-xs font-medium hover:underline'>
                <Plus className='size-3.5' aria-hidden />
                Add item
              </button>
              <span className='text-foreground text-sm font-semibold'>Total {reviewTotal(items)} kcal</span>
            </div>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2'>
        <Button key='save' type='submit' variant='brand' disabled={saving || items.length === 0}>
          {saving ? <Loader2 className='animate-spin' aria-hidden /> : <Plus aria-hidden />}
          {saveLabel(items.length)}
        </Button>
        <Button key='discard' type='button' variant='ghost' onClick={() => dispatch({ type: "discard" })}>
          Discard
        </Button>
      </div>
    </form>
  );
}
