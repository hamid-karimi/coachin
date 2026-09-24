"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAddSupplement } from "../hooks/use-supplements";
import { DEFAULT_SCHEDULE, scheduleBody, type ScheduleValue } from "../lib/supplements";
import { ScheduleFields } from "./schedule-fields";

interface Draft {
  name: string;
  dose: string;
  schedule: ScheduleValue;
}

const EMPTY: Draft = { name: "", dose: "", schedule: DEFAULT_SCHEDULE };

export function AddSupplementForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const add = useAddSupplement(() => setDraft(EMPTY));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    add.mutate({ body: { name: draft.name, dose: draft.dose, ...scheduleBody(draft.schedule) } });
  }

  return (
    <form onSubmit={submit} className='space-y-3'>
      <div className='space-y-1.5'>
        <Label htmlFor='supplement-name'>Name</Label>
        <Input
          id='supplement-name'
          maxLength={60}
          placeholder='Creatine'
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='supplement-dose'>Dose (optional)</Label>
        <Input
          id='supplement-dose'
          maxLength={40}
          placeholder='5g after training'
          value={draft.dose}
          onChange={(e) => setDraft({ ...draft, dose: e.target.value })}
        />
      </div>
      <ScheduleFields idPrefix='add' value={draft.schedule} onChange={(schedule) => setDraft({ ...draft, schedule })} />
      <Button type='submit' variant='brand' size='sm' disabled={add.isPending}>
        <Plus aria-hidden />
        {add.isPending ? "Adding…" : "Add supplement"}
      </Button>
    </form>
  );
}
