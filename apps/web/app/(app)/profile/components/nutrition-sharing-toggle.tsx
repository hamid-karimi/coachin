"use client";

import { Loader2, Salad } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBodyProfile, useNutritionSharing } from "../hooks/use-profile";

/** Trainee opt-in: the active coach may read meal logs and the meal plan. */
export function NutritionSharingToggle() {
  const { nutritionSharing: enabled } = useBodyProfile();
  const toggle = useNutritionSharing();
  return (
    <div className='flex items-center justify-between gap-3'>
      <div className='flex min-w-0 items-center gap-2.5'>
        <Salad className='text-brand-ink size-4 shrink-0' aria-hidden />
        <div className='min-w-0'>
          <p className='text-foreground text-sm font-medium'>Share nutrition with my coach</p>
          <p className='text-muted-foreground text-xs'>
            {enabled
              ? "Your coach can see your meal logs and meal plan."
              : "Off — only you can see your meal logs and meal plan."}
          </p>
        </div>
      </div>
      <Button
        type='button'
        size='sm'
        variant={enabled ? "secondary" : "brand"}
        disabled={toggle.isPending}
        onClick={() => toggle.mutate({ body: { enabled: !enabled } })}>
        {toggle.isPending ? <Loader2 className='animate-spin' aria-hidden /> : enabled ? "Turn off" : "Turn on"}
      </Button>
    </div>
  );
}
