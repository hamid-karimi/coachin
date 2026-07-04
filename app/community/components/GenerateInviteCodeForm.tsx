"use client";

import { useActionState } from "react";
import { useActionToast } from "@/components/hooks/use-action-toast";
import {
  type CommunityActionState,
  generateCoachInviteCodeAction,
} from "../actions";
import type { CoachInviteCodeSummary, SportTypeSummary } from "../types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const initialState: CommunityActionState = {};

interface GenerateInviteCodeFormProps {
  sportTypes: SportTypeSummary[];
  inviteCodes: CoachInviteCodeSummary[];
}

export function GenerateInviteCodeForm({
  sportTypes,
  inviteCodes,
}: GenerateInviteCodeFormProps) {
  const [state, formAction, pending] = useActionState(
    generateCoachInviteCodeAction,
    initialState,
  );
  useActionToast(state);

  return (
    <div className='space-y-4'>
      <form action={formAction} className='space-y-2'>
        <Label htmlFor='sport-type-id' className='text-muted-foreground'>
          Generate invite code for sport
        </Label>

        <div className='flex gap-2'>
          <select
            id='sport-type-id'
            name='sport_type_id'
            className='border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 flex h-11 w-full min-w-0 flex-1 rounded-md border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-[3px]'
            required>
            <option value=''>Select sport type</option>
            {sportTypes.map((sport) => (
              <option key={sport.id ?? "unknown"} value={sport.id ?? ""}>
                {sport.name ?? "Sport"}
              </option>
            ))}
          </select>

          <Button type='submit' variant='secondary' disabled={pending}>
            {pending ? "Generating…" : "New invite code"}
          </Button>
        </div>
      </form>

      <div className='space-y-2'>
        {inviteCodes.length === 0 ? (
          <p className='text-muted-foreground text-xs'>
            No invite codes yet — generate one and share it with a student.
          </p>
        ) : (
          <ul className='space-y-2'>
            {inviteCodes.map((invite) => (
              <li
                key={invite.code}
                className='border-brand/40 bg-brand-tint flex items-center justify-between gap-3 rounded-lg border border-dashed px-3.5 py-2.5 text-sm'>
                <div className='min-w-0'>
                  <p className='text-brand-ink truncate font-mono font-bold tracking-[0.08em]'>
                    {invite.code}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    {invite.sport_type?.name ?? "No sport"}
                  </p>
                </div>
                <Badge variant={invite.is_active ? "brand" : "outline"}>
                  {invite.is_active ? "Active" : "Inactive"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
