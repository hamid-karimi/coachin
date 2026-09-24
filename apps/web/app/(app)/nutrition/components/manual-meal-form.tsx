"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ManualDraft } from "../lib/meal-logger";

const EMPTY: ManualDraft = { name: "", kcal: "", protein: "" };

/** A hand-entered meal: name, calories, optional protein. Cleared after a successful log. */
export function ManualMealForm({
  pending,
  onLog,
}: {
  pending: boolean;
  onLog: (draft: ManualDraft, reset: () => void) => void;
}) {
  const [draft, setDraft] = useState(EMPTY);
  const set = (field: keyof ManualDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft({ ...draft, [field]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onLog(draft, () => setDraft(EMPTY));
      }}
      className='flex flex-wrap items-end gap-3'>
      <div className='min-w-40 flex-1 space-y-1.5'>
        <Label htmlFor='manual_name'>Food</Label>
        <Input id='manual_name' value={draft.name} onChange={set("name")} placeholder='Homemade soup' required />
      </div>
      <div className='w-24 space-y-1.5'>
        <Label htmlFor='manual_kcal'>kcal</Label>
        <Input id='manual_kcal' type='number' min={1} max={5000} value={draft.kcal} onChange={set("kcal")} required />
      </div>
      <div className='w-20 space-y-1.5'>
        <Label htmlFor='manual_protein'>Protein</Label>
        <Input
          id='manual_protein'
          type='number'
          min={0}
          placeholder='0'
          value={draft.protein}
          onChange={set("protein")}
        />
      </div>
      <Button type='submit' variant='brand' disabled={pending}>
        {pending ? <Loader2 className='animate-spin' aria-hidden /> : <Plus aria-hidden />}
        Log
      </Button>
    </form>
  );
}
