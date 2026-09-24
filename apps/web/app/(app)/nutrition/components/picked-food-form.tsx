"use client";

import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FoodUnit } from "@/lib/food-units";
import { pickedSummary, type PickedFood } from "../lib/meal-logger";
import { UnitSelect } from "./unit-select";

interface PickedFoodFormProps {
  picked: PickedFood;
  amount: string;
  unit: FoodUnit;
  grams: number;
  pending: boolean;
  onAmount: (amount: string) => void;
  onUnit: (unit: FoodUnit) => void;
  onLog: () => void;
  onClear: () => void;
}

/** The picked food with an amount in any household unit (sent as grams). */
export function PickedFoodForm({
  picked,
  amount,
  unit,
  grams,
  pending,
  onAmount,
  onUnit,
  onLog,
  onClear,
}: PickedFoodFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onLog();
      }}
      className='flex flex-wrap items-end gap-3'>
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{picked.food.name}</p>
        <p className='text-muted-foreground text-xs'>{pickedSummary(picked, grams)}</p>
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='amount'>Amount</Label>
        <div className='flex items-center gap-1.5'>
          <Input
            id='amount'
            type='number'
            inputMode='decimal'
            min={0.1}
            step='any'
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            className='w-24'
            required
          />
          <UnitSelect value={unit} onChange={onUnit} />
        </div>
      </div>
      <Button type='submit' variant='brand' disabled={pending || grams <= 0}>
        {pending ? <Loader2 className='animate-spin' aria-hidden /> : <Plus aria-hidden />}
        Log
      </Button>
      <button
        type='button'
        aria-label='Clear selection'
        onClick={onClear}
        className='text-muted-foreground hover:text-foreground grid size-8 place-items-center'>
        <X className='size-4' aria-hidden />
      </button>
    </form>
  );
}
