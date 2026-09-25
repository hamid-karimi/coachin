"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateGroup, useJoinGroup } from "../hooks/use-community";

/** Start a group, or join one by invite code. */
export function GroupForms() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const create = useCreateGroup(() => setName(""));
  const join = useJoinGroup(() => setCode(""));
  return (
    <div className='grid gap-3 md:grid-cols-2'>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ body: { name } });
        }}
        className='space-y-1.5'>
        <Label htmlFor='group-name'>Create a group</Label>
        <div className='flex gap-2'>
          <Input
            id='group-name'
            minLength={3}
            maxLength={60}
            required
            placeholder='Group name'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type='submit' disabled={create.isPending}>
            {create.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
            Create
          </Button>
        </div>
      </form>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join.mutate({ body: { code } });
        }}
        className='space-y-1.5'>
        <Label htmlFor='group-code'>Join with group invite code</Label>
        <div className='flex gap-2'>
          <Input
            id='group-code'
            required
            placeholder='GRP-A1B2C3'
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type='submit' variant='secondary' disabled={join.isPending}>
            {join.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
            Join
          </Button>
        </div>
      </form>
    </div>
  );
}
