"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useCoachingHub, useGenerateInviteCode, useSportTypes } from "../hooks/use-coaching";

/** Generate a per-sport invite code and list the coach's codes. */
export function InviteCodesCard() {
  const { inviteCodes } = useCoachingHub();
  const sports = useSportTypes();
  const [sportId, setSportId] = useState("");
  const generate = useGenerateInviteCode();

  return (
    <section className='bg-card border-border space-y-4 rounded-xl border p-4'>
      <h2 className='text-[15px] font-bold'>Invite codes</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate.mutate({ body: { sportTypeId: Number(sportId) } });
        }}
        className='space-y-2'>
        <Label htmlFor='sport-type-id' className='text-muted-foreground'>
          Generate invite code for sport
        </Label>
        <div className='flex gap-2'>
          <NativeSelect
            id='sport-type-id'
            required
            value={sportId}
            onChange={(e) => setSportId(e.target.value)}
            className='flex-1'>
            <option value=''>Select sport type</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </NativeSelect>
          <Button type='submit' variant='secondary' disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
            {generate.isPending ? "Generating…" : "New invite code"}
          </Button>
        </div>
      </form>
      {inviteCodes.length === 0 ? (
        <p className='text-muted-foreground text-xs'>No invite codes yet — generate one and share it with a trainee.</p>
      ) : (
        <ul className='space-y-2'>
          {inviteCodes.map((invite) => (
            <li
              key={invite.code}
              className='border-brand/40 bg-brand-tint flex items-center justify-between gap-3 rounded-lg border border-dashed px-3.5 py-2.5 text-sm'>
              <div className='min-w-0'>
                <p className='text-brand-ink truncate font-mono font-bold tracking-[0.08em] select-all'>
                  {invite.code}
                </p>
                <p className='text-muted-foreground text-xs'>{invite.sport?.name ?? "No sport"}</p>
              </div>
              <Badge variant={invite.isActive ? "brand" : "outline"}>{invite.isActive ? "Active" : "Inactive"}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
