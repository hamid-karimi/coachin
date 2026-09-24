"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  type CommunityActionState,
  connectCoachByCodeAction,
} from "../actions";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: CommunityActionState = {};

export function AddCoachByCodeForm() {
  const [state, formAction, pending] = useActionState(
    connectCoachByCodeAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction} className='space-y-2'>
      <Label htmlFor='coach-invite-code' className='text-muted-foreground'>
        Connect to a coach with their code
      </Label>
      <div className='flex gap-2'>
        <Input
          id='coach-invite-code'
          type='text'
          name='invite_code'
          placeholder='COACH-2-X7H9KD'
          className='font-mono uppercase placeholder:normal-case'
          required
        />
        <Button type='submit' variant='secondary' disabled={pending}>
          {pending ? "Connecting…" : "Connect"}
        </Button>
      </div>
    </form>
  );
}
