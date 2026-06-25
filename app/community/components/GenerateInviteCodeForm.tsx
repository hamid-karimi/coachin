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
            className='flex h-9 w-full min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
            required>
            <option value=''>Select sport type</option>
            {sportTypes.map((sport) => (
              <option key={sport.id ?? "unknown"} value={sport.id ?? ""}>
                {sport.name ?? "Sport"}
              </option>
            ))}
          </select>

          <Button type='submit' disabled={pending}>
            {pending ? "Generating..." : "Generate code"}
          </Button>
        </div>
      </form>

      <div className='space-y-2'>
        <p className='text-xs text-muted-foreground'>
          Your current invite codes
        </p>
        {inviteCodes.length === 0 ? (
          <p className='text-xs text-muted-foreground'>No invite codes yet.</p>
        ) : (
          <ul className='space-y-2'>
            {inviteCodes.map((invite) => (
              <li
                key={invite.code}
                className='flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm'>
                <div className='min-w-0'>
                  <p className='truncate font-mono text-foreground'>
                    {invite.code}
                  </p>
                  <p className='text-xs text-muted-foreground'>
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
