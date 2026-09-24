"use client";

import { useState, useActionState } from "react";
import { Flame, UsersRound } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TrainingGroup } from "../lib/groups-data";
import {
  createGroupAction,
  joinGroupAction,
  leaveGroupAction,
  type GroupsActionState,
} from "../groups/actions";

const initialState: GroupsActionState = {};

interface GroupsSectionProps {
  groups: TrainingGroup[];
}

export function GroupsSection({ groups }: GroupsSectionProps) {
  const [createState, createAction, creating] = useActionState(
    createGroupAction,
    initialState,
  );
  const [joinState, joinAction, joining] = useActionState(
    joinGroupAction,
    initialState,
  );
  const [leaveState, leaveAction, leaving] = useActionState(
    leaveGroupAction,
    initialState,
  );
  useActionToast(createState);
  useActionToast(joinState);
  useActionToast(leaveState);

  const [confirmLeave, setConfirmLeave] = useState<TrainingGroup | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-bold'>Group Streaks</CardTitle>
        <CardDescription>
          Train together: on days when everyone logs a workout, the group
          streak grows and every member earns bonus XP. A missed day freezes
          the streak — it never resets.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-4'>
        <form action={createAction} className='space-y-2'>
          <Label htmlFor='group-name' className='text-muted-foreground'>
            Create a group
          </Label>
          <div className='flex gap-2'>
            <Input
              id='group-name'
              name='group_name'
              type='text'
              required
              minLength={3}
              maxLength={60}
              placeholder='Group name'
            />
            <Button type='submit' disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>

        <form action={joinAction} className='space-y-2'>
          <Label htmlFor='group-invite-code' className='text-muted-foreground'>
            Join with group invite code
          </Label>
          <div className='flex gap-2'>
            <Input
              id='group-invite-code'
              name='group_invite_code'
              type='text'
              required
              placeholder='Example: GRP-A1B2C3'
            />
            <Button type='submit' variant='secondary' disabled={joining}>
              {joining ? "Joining..." : "Join"}
            </Button>
          </div>
        </form>

        {groups.length === 0 ? (
          <div className='border-border flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center'>
            <UsersRound className='text-muted-foreground size-5' aria-hidden />
            <p className='text-foreground text-sm font-medium'>No groups yet</p>
            <p className='text-muted-foreground text-xs'>
              Create one and share the invite code — group streaks need at
              least 2 members.
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className='border-border space-y-3 rounded-xl border p-4'
            >
              <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <p className='text-foreground truncate text-sm font-bold'>
                    {group.name}
                  </p>
                  <p className='text-muted-foreground text-xs'>
                    Invite code: {group.invite_code}
                    {group.members.length < 2 &&
                      " · needs a 2nd member to start"}
                  </p>
                </div>
                <span className='bg-flame-tint text-flame-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold'>
                  <Flame className='size-3.5' aria-hidden />
                  {group.streak_count} day streak
                  <span className='font-normal'>
                    · best {group.best_streak}
                  </span>
                </span>
              </div>

              {/* Last 7 evaluated days */}
              {group.recent_days.length > 0 && (
                <div className='flex items-center gap-1.5'>
                  {group.recent_days.map((day) => (
                    <span
                      key={day.date}
                      title={`${day.date}: ${day.all_trained ? "everyone trained" : "streak frozen"}`}
                      className={cn(
                        "size-2 rounded-full",
                        day.all_trained ? "bg-success" : "bg-border",
                      )}
                    />
                  ))}
                  <span className='text-muted-foreground ml-1 text-[11px]'>
                    last {group.recent_days.length} days
                  </span>
                </div>
              )}

              {/* Members, ranked by weekly XP */}
              <ul className='space-y-1.5'>
                {group.members.map((member, index) => (
                  <li
                    key={member.user_id}
                    className='flex items-center gap-2.5'
                  >
                    <span className='text-muted-foreground w-4 text-xs font-semibold'>
                      {index + 1}
                    </span>
                    <span className='relative'>
                      <Avatar className='size-7'>
                        {member.avatar_url ? (
                          <AvatarImage
                            src={member.avatar_url}
                            alt={member.name}
                          />
                        ) : null}
                        <AvatarFallback className='text-[10px] font-semibold'>
                          {member.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        title={
                          member.trained_today
                            ? "Trained today"
                            : "Not yet today"
                        }
                        className={cn(
                          "border-card absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2",
                          member.trained_today ? "bg-success" : "bg-border",
                        )}
                      />
                    </span>
                    <span className='min-w-0 flex-1 truncate text-sm'>
                      {member.name}
                    </span>
                    <span className='text-stat text-brand-ink text-xs'>
                      {member.weekly_xp} XP
                    </span>
                  </li>
                ))}
              </ul>

              <Button
                type='button'
                size='sm'
                variant='destructive-outline'
                onClick={() => setConfirmLeave(group)}
              >
                Leave group
              </Button>
            </div>
          ))
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmLeave !== null}
        title={confirmLeave ? `Leave ${confirmLeave.name}?` : ""}
        description="The group's streak continues without you. If you are the last member, the group is deleted."
        confirmLabel='Leave group'
        pending={leaving}
        onCancel={() => setConfirmLeave(null)}
        onConfirm={() => {
          if (!confirmLeave) return;
          const formData = new FormData();
          formData.set("group_id", confirmLeave.id);
          leaveAction(formData);
          setConfirmLeave(null);
        }}
      />
    </Card>
  );
}
