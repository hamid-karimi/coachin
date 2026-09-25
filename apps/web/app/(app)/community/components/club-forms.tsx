"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateClub, useJoinClub } from "../hooks/use-community";

/** Create a club, or join one by invite code. */
export function ClubForms() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const create = useCreateClub(() => {
    setName("");
    setDescription("");
  });
  const join = useJoinClub(() => setCode(""));

  return (
    <div className='grid gap-3 md:grid-cols-2'>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ body: { name, description } });
        }}
        className='bg-card border-border space-y-3 rounded-xl border p-4'>
        <h2 className='text-[15px] font-bold'>Create a club</h2>
        <div className='space-y-1.5'>
          <Label htmlFor='club-name'>Name</Label>
          <Input
            id='club-name'
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Night Runners'
          />
        </div>
        <div className='space-y-1.5'>
          <Label htmlFor='club-description'>Description (optional)</Label>
          <Input
            id='club-description'
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Tuesday and Thursday evening runs'
          />
        </div>
        <Button type='submit' variant='brand' disabled={create.isPending || name.trim() === ""}>
          {create.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
          Create club
        </Button>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate({ body: { code } });
        }}
        className='bg-card border-border space-y-3 rounded-xl border p-4'>
        <h2 className='text-[15px] font-bold'>Join a club</h2>
        <div className='space-y-1.5'>
          <Label htmlFor='club-code'>Club invite code</Label>
          <Input
            id='club-code'
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder='CLUB-ABC234'
            className='font-mono uppercase'
          />
        </div>
        <Button type='submit' variant='secondary' disabled={join.isPending || code.trim() === ""}>
          {join.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
          Join club
        </Button>
      </form>
    </div>
  );
}
