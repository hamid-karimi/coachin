import { FOOD_UNIT_OPTIONS, type FoodUnit } from "@/lib/food-units";
import { cn } from "@/lib/utils";

/** Native amount-unit dropdown, sized to sit beside an Input. */
export function UnitSelect({
  value,
  onChange,
  className,
}: {
  value: FoodUnit;
  onChange: (unit: FoodUnit) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as FoodUnit)}
      aria-label='Unit'
      className={cn(
        "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/25 h-11 rounded-md border px-2 text-sm transition-colors outline-none focus-visible:ring-[3px]",
        className,
      )}>
      {FOOD_UNIT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
