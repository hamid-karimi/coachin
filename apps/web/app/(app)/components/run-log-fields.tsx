import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RunField, SessionLogDraft } from "@/lib/session-log";

const FIELDS: {
  field: RunField;
  label: string;
  step: string;
  placeholder: string;
}[] = [
  {
    field: "distanceKm",
    label: "Distance (km)",
    step: "0.1",
    placeholder: "10",
  },
  {
    field: "durationMin",
    label: "Duration (min)",
    step: "1",
    placeholder: "55",
  },
  { field: "avgHr", label: "Avg HR", step: "1", placeholder: "150" },
];

interface RunLogFieldsProps {
  itemId: string;
  draft: SessionLogDraft;
  onChange: (field: RunField, value: string) => void;
}

/** A run's actuals, all optional. */
export function RunLogFields({ itemId, draft, onChange }: RunLogFieldsProps) {
  return (
    <div className='grid grid-cols-3 gap-3'>
      {FIELDS.map(({ field, label, step, placeholder }) => (
        <div key={field} className='space-y-1.5'>
          <Label htmlFor={`${field}-${itemId}`}>{label}</Label>
          <Input
            id={`${field}-${itemId}`}
            type='number'
            inputMode='decimal'
            min={0}
            step={step}
            placeholder={placeholder}
            value={draft[field]}
            onChange={(e) => onChange(field, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
