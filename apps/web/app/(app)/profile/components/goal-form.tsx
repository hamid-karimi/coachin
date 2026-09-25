"use client";

import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCreateGoal } from "../hooks/use-profile";
import { GOAL_META, goalInput, type GoalType } from "../lib/profile";

/** Set a new goal for a metric that has none active. */
export function GoalForm({ types }: { types: GoalType[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const create = useCreateGoal(() => formRef.current?.reset());
  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ body: goalInput(new FormData(e.currentTarget)) });
      }}
      className='bg-card border-border flex flex-wrap items-end gap-3 rounded-xl border p-4'>
      <div className='min-w-40 flex-1 space-y-1.5'>
        <Label htmlFor='goalType'>New goal</Label>
        <NativeSelect id='goalType' name='goalType' required defaultValue=''>
          <option value='' disabled>
            Pick a metric
          </option>
          {types.map((type) => (
            <option key={type} value={type}>
              {GOAL_META[type].label} ({GOAL_META[type].unit})
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className='min-w-24 flex-1 space-y-1.5'>
        <Label htmlFor='target'>Target</Label>
        <Input
          id='target'
          name='target'
          type='number'
          inputMode='decimal'
          step='0.1'
          min={0.1}
          required
          placeholder='70'
        />
      </div>
      <div className='min-w-32 flex-1 space-y-1.5'>
        <Label htmlFor='targetDate'>By (optional)</Label>
        <Input id='targetDate' name='targetDate' type='date' />
      </div>
      <Button type='submit' variant='brand' disabled={create.isPending}>
        {create.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
        Set goal
      </Button>
    </form>
  );
}
