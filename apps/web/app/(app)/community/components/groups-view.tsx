"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { useGroups, useLeaveGroup } from "../hooks/use-community";
import type { TrainingGroup } from "../lib/community";
import { GroupCard } from "./group-card";
import { GroupForms } from "./group-forms";

/** Group streaks: create / join, then each group's streak and members. */
export function GroupsView() {
  const groups = useGroups();
  const [leaving, setLeaving] = useState<TrainingGroup | null>(null);
  const leave = useLeaveGroup(() => setLeaving(null));
  return (
    <section className='bg-card border-border space-y-4 rounded-xl border p-4'>
      <div>
        <h2 className='text-lg font-bold'>Group Streaks</h2>
        <p className='text-muted-foreground text-sm'>
          Train together: on days when everyone logs a workout, the group streak grows and every member earns bonus XP.
          A missed day freezes the streak — it never resets.
        </p>
      </div>
      <GroupForms />
      {groups.length === 0 ? (
        <div className='border-border rounded-lg border border-dashed p-4 text-center'>
          <p className='text-foreground text-sm font-medium'>No groups yet</p>
          <p className='text-muted-foreground text-xs'>
            Create one and share the invite code — group streaks need at least 2 members.
          </p>
        </div>
      ) : (
        groups.map((group) => <GroupCard key={group.id} group={group} onLeave={() => setLeaving(group)} />)
      )}
      <ConfirmDialog
        open={leaving !== null}
        title={leaving ? `Leave ${leaving.name}?` : ""}
        description="The group's streak continues without you. If you are the last member, the group is deleted."
        confirmLabel='Leave group'
        pending={leave.isPending}
        onCancel={() => setLeaving(null)}
        onConfirm={() => leaving && leave.mutate({ params: { path: { id: leaving.id } } })}
      />
    </section>
  );
}
