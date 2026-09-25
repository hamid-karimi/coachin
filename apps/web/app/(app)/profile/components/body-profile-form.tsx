"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useBodyProfile, useSaveBodyProfile } from "../hooks/use-profile";
import { bodyProfileInput } from "../lib/profile";

/** Birth date, sex, height, country, training history — the AI plans' intake. */
export function BodyProfileForm() {
  const body = useBodyProfile();
  const save = useSaveBodyProfile();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ body: bodyProfileInput(new FormData(e.currentTarget)) });
      }}
      className='bg-card border-border space-y-4 rounded-xl border p-4'>
      <div className='grid gap-4 sm:grid-cols-3'>
        <div className='space-y-1.5'>
          <Label htmlFor='birthDate'>Birth date</Label>
          <Input id='birthDate' name='birthDate' type='date' defaultValue={body.birthDate ?? ""} />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='sex'>Sex</Label>
          <NativeSelect id='sex' name='sex' defaultValue={body.sex ?? ""}>
            <option value=''>Prefer not to say</option>
            <option value='male'>Male</option>
            <option value='female'>Female</option>
            <option value='other'>Other</option>
          </NativeSelect>
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='heightCm'>Height (cm)</Label>
          <Input
            id='heightCm'
            name='heightCm'
            type='number'
            inputMode='decimal'
            step='0.5'
            min={100}
            max={250}
            placeholder='175'
            defaultValue={body.heightCm ?? ""}
          />
        </div>
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='country'>Country</Label>
        <Input id='country' name='country' maxLength={56} placeholder='Iran' defaultValue={body.country ?? ""} />
        <p className='text-muted-foreground text-xs'>
          Meal plans and food recognition prefer dishes and ingredients that are common and affordable where you live.
        </p>
      </div>
      <div className='space-y-1.5'>
        <Label htmlFor='trainingHistory'>Training history</Label>
        <Textarea
          id='trainingHistory'
          name='trainingHistory'
          rows={3}
          maxLength={2000}
          placeholder='Example: running 3x/week for 2 years, one half marathon (1:55), knee injury in 2024.'
          defaultValue={body.trainingHistory ?? ""}
        />
        <p className='text-muted-foreground text-xs'>Used to personalize your training program and diet suggestions.</p>
      </div>
      <p className='text-muted-foreground text-xs'>
        Weight and body fat come from your latest measurement on the Progress tab.
      </p>
      <Button type='submit' variant='brand' disabled={save.isPending}>
        {save.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
        Save profile
      </Button>
    </form>
  );
}
