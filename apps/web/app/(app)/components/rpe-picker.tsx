import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const RPE_VALUES = Array.from({ length: 10 }, (_, index) => index + 1);

interface RpePickerProps {
  value: number | null;
  /** Called with the tapped value; tapping the selected one clears it. */
  onToggle: (value: number) => void;
}

/** Perceived effort 1–10, optional. */
export function RpePicker({ value, onToggle }: RpePickerProps) {
  return (
    <div className='space-y-1.5'>
      <Label>Effort (RPE, optional)</Label>
      <div className='flex flex-wrap gap-1.5'>
        {RPE_VALUES.map((rpe) => (
          <button
            key={rpe}
            type='button'
            aria-pressed={value === rpe}
            onClick={() => onToggle(rpe)}
            className={cn(
              "grid size-7 place-items-center rounded-md border text-xs font-medium transition-colors",
              value === rpe
                ? "bg-brand border-brand text-brand-foreground"
                : "border-border text-muted-foreground hover:border-brand/50",
            )}>
            {rpe}
          </button>
        ))}
      </div>
    </div>
  );
}
