"use client";

import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDiscardMealPlan, useRegenerateMealPlan } from "../hooks/use-meal-plan";

/** Regenerate (same answers, new week) or discard the plan. */
export function MealPlanActions() {
  const regenerate = useRegenerateMealPlan();
  const discard = useDiscardMealPlan();
  const busy = regenerate.isPending || discard.isPending;
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Button type='button' variant='outline' disabled={busy} onClick={() => regenerate.mutate({})}>
        {regenerate.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <RefreshCw aria-hidden />}
        {regenerate.isPending ? "Generating a new week…" : "Regenerate"}
      </Button>
      <Button
        type='button'
        variant='ghost'
        disabled={busy}
        className='text-muted-foreground'
        onClick={() => discard.mutate({})}>
        {discard.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Trash2 aria-hidden />}
        Discard
      </Button>
    </div>
  );
}
