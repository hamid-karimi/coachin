"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SCHEDULE_OPTIONS, SCHEDULE_WEEKDAYS, toggleDay, type ScheduleType, type ScheduleValue } from "../lib/supplements";

// Native <select> styled like the Input primitive (design-system tokens).
const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 flex h-11 w-full rounded-md border px-3.5 py-1 text-base transition-colors outline-none focus-visible:ring-[3px] md:text-[15px]";

interface ScheduleFieldsProps {
  idPrefix: string;
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

/** Schedule type plus weekday chips (custom only). */
export function ScheduleFields({ idPrefix, value, onChange }: ScheduleFieldsProps) {
  return (
    <div className='space-y-2'>
      <div className='space-y-1.5'>
        <Label htmlFor={`${idPrefix}-schedule`}>Schedule</Label>
        <select
          id={`${idPrefix}-schedule`}
          value={value.scheduleType}
          onChange={(e) => onChange({ ...value, scheduleType: e.target.value as ScheduleType })}
          className={SELECT_CLASS}>
          {SCHEDULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {value.scheduleType === "custom" && (
        <fieldset className='flex flex-wrap gap-1.5'>
          <legend className='text-muted-foreground mb-1 text-xs'>Days of the week</legend>
          {SCHEDULE_WEEKDAYS.map((day) => {
            const checked = value.daysOfWeek.includes(day.id);
            return (
              <button
                key={day.id}
                type='button'
                aria-pressed={checked}
                onClick={() => onChange({ ...value, daysOfWeek: toggleDay(value.daysOfWeek, day.id) })}
                className={cn(
                  "border-border text-muted-foreground rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  checked && "bg-brand border-brand text-brand-foreground",
                )}>
                {day.short}
              </button>
            );
          })}
        </fieldset>
      )}
    </div>
  );
}
