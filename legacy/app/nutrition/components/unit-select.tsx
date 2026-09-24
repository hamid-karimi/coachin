"use client";

import { FOOD_UNIT_OPTIONS, type FoodUnit } from "@/lib/food-units";
import { cn } from "@/lib/utils";

/** Native amount-unit dropdown, styled to sit beside an Input. */
export function UnitSelect({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: FoodUnit;
  onChange: (unit: FoodUnit) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as FoodUnit)}
      aria-label="Unit"
      className={cn(
        "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/25 h-11 rounded-md border px-2 text-sm outline-none transition-colors focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {FOOD_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
