"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useJoinCoach } from "../hooks/use-profile";

/** Redeem a coach's invite code (lives here while Community is off). */
export function JoinCoachForm() {
  const [code, setCode] = useState("");
  const join = useJoinCoach(() => setCode(""));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        join.mutate({ body: { code } });
      }}
      className='space-y-2'>
      <Label htmlFor='invite-code'>Coach invite code</Label>
      <div className='flex gap-2'>
        <Input
          id='invite-code'
          placeholder='COACH-1-ABC234'
          autoCapitalize='characters'
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className='flex-1 font-mono uppercase'
        />
        <Button type='submit' variant='secondary' disabled={join.isPending || code.trim() === ""}>
          {join.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
          Add coach
        </Button>
      </div>
      <p className='text-muted-foreground text-xs'>Your coach sees your level, XP, and this week&apos;s workouts.</p>
    </form>
  );
}
