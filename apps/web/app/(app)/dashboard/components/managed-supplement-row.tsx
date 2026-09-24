"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRemoveSupplement, useRescheduleSupplement } from "../hooks/use-supplements";
import { scheduleBody, type ScheduleValue, type Supplement } from "../lib/supplements";
import { ScheduleFields } from "./schedule-fields";

function ScheduleEditor({ supplement, onSaved }: { supplement: Supplement; onSaved: () => void }) {
  const [value, setValue] = useState<ScheduleValue>({
    scheduleType: supplement.scheduleType,
    daysOfWeek: supplement.daysOfWeek,
  });
  const save = useRescheduleSupplement(onSaved);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ params: { path: { id: supplement.id } }, body: scheduleBody(value) });
      }}
      className='mt-2 space-y-3'>
      <ScheduleFields idPrefix={`edit-${supplement.id}`} value={value} onChange={setValue} />
      <Button type='submit' variant='brand' size='sm' disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save schedule"}
      </Button>
    </form>
  );
}

/** A stack entry in the manage sheet: schedule, inline edit, remove. */
export function ManagedSupplementRow({ supplement }: { supplement: Supplement }) {
  const [editing, setEditing] = useState(false);
  const remove = useRemoveSupplement();

  return (
    <li className='py-1.5'>
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <p className='text-foreground truncate text-sm'>
            {supplement.name}
            {supplement.dose && <span className='text-muted-foreground'> · {supplement.dose}</span>}
          </p>
          <p className='text-muted-foreground text-xs'>{supplement.scheduleLabel}</p>
        </div>
        <div className='flex shrink-0 items-center'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => setEditing((open) => !open)}
            aria-expanded={editing}
            aria-label={`Edit ${supplement.name} schedule`}>
            <Pencil aria-hidden />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            disabled={remove.isPending}
            onClick={() => remove.mutate({ params: { path: { id: supplement.id } } })}
            aria-label={`Remove ${supplement.name}`}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      {editing && <ScheduleEditor supplement={supplement} onSaved={() => setEditing(false)} />}
    </li>
  );
}
