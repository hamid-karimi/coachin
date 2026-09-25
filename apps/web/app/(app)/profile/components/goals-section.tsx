"use client";

import { useState } from "react";
import { Target, Trophy } from "lucide-react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAbandonGoal, useGoals } from "../hooks/use-profile";
import { availableGoalTypes, GOAL_META, goalLabel, goalStatusLine, type ActiveGoal } from "../lib/profile";
import { GoalForm } from "./goal-form";

/** Active goals with progress, recent wins, and the new-goal form. */
export function GoalsSection() {
  const { active, achieved } = useGoals();
  const abandon = useAbandonGoal();
  const [confirming, setConfirming] = useState<ActiveGoal | null>(null);
  const types = availableGoalTypes(active);

  return (
    <div className='space-y-2.5'>
      {active.length === 0 ? (
        <div className='border-border rounded-xl border border-dashed p-5 text-center'>
          <Target className='text-muted-foreground mx-auto mb-1.5 size-5' aria-hidden />
          <p className='text-foreground text-sm font-medium'>No goals yet</p>
          <p className='text-muted-foreground text-xs'>Set a target below — reaching it pays +200 XP.</p>
        </div>
      ) : (
        <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
          {active.map((goal) => (
            <div key={goal.id} className='space-y-2 py-3.5'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-foreground text-sm font-semibold'>
                  {GOAL_META[goal.goalType].label}
                  <span className='text-muted-foreground font-normal'>
                    {" "}
                    → {goal.target}
                    {GOAL_META[goal.goalType].unit}
                  </span>
                </p>
                <Button type='button' size='sm' variant='destructive-outline' onClick={() => setConfirming(goal)}>
                  Remove
                </Button>
              </div>
              {goal.progress && <Progress value={goal.progress.pct} />}
              <p className='text-muted-foreground text-xs'>{goalStatusLine(goal)}</p>
            </div>
          ))}
        </div>
      )}

      {achieved.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {achieved.map((goal) => (
            <Badge key={goal.id} variant='success'>
              <Trophy aria-hidden />
              {goalLabel(goal)}
            </Badge>
          ))}
        </div>
      )}

      {types.length > 0 && <GoalForm types={types} />}

      <ConfirmDialog
        open={confirming !== null}
        title={confirming ? `Remove your ${GOAL_META[confirming.goalType].label.toLowerCase()} goal?` : ""}
        description="Progress is kept, but this goal stops tracking and won't pay XP."
        confirmLabel='Remove goal'
        pending={abandon.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          abandon.mutate({ params: { path: { id: confirming.id } } }, { onSettled: () => setConfirming(null) });
        }}
      />
    </div>
  );
}
