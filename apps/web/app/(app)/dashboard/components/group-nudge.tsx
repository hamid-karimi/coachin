"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { $api } from "@/lib/api/browser";
import { groupNudgeTitle } from "@/app/(app)/community/lib/community";

/** Community on, nothing logged today, a group with a live streak: a push to train. */
export function GroupNudge() {
  const { groupName, streakCount } = $api.useSuspenseQuery("get", "/community/group-nudge").data;
  if (!groupName) return null;
  return (
    <Link
      href='/community/groups'
      className='bg-flame-tint border-flame/30 flex items-center gap-3.5 rounded-2xl border p-4'>
      <span className='text-flame-ink grid size-10 shrink-0 place-items-center'>
        <Flame className='size-6' aria-hidden />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='text-flame-ink block text-sm font-bold'>{groupNudgeTitle(groupName, streakCount)}</span>
        <span className='text-flame-ink/80 block text-[13px]'>
          Log a workout today so nobody&apos;s streak freezes.
        </span>
      </span>
    </Link>
  );
}
