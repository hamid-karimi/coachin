"use client";

import { useState, useActionState } from "react";
import { Loader2, Target, Trophy } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { GOAL_TYPE_META, type Goal, type GoalType } from "@/lib/goals";
import type { GoalWithProgress } from "@/lib/goals-data";
import {
  abandonGoalAction,
  createGoalAction,
} from "../goals-actions";
import type { ProfileActionState } from "../actions";

const initialState: ProfileActionState = {};

const SOURCE_HINTS: Record<string, string> = {
  nutrition: "Tracking arrives with calorie logging.",
  activity: "Tracking arrives once runs carry distance.",
};

interface GoalsSectionProps {
  active: GoalWithProgress[];
  achieved: Goal[];
}

export function GoalsSection({ active, achieved }: GoalsSectionProps) {
  const [createState, createAction, creating] = useActionState(
    createGoalAction,
    initialState,
  );
  const [abandonState, abandonAction, abandoning] = useActionState(
    abandonGoalAction,
    initialState,
  );
  useActionToast(createState);
  useActionToast(abandonState);

  const [confirmGoal, setConfirmGoal] = useState<GoalWithProgress | null>(null);

  const activeTypes = new Set(active.map((goal) => goal.goal_type));
  const availableTypes = (
    Object.keys(GOAL_TYPE_META) as GoalType[]
  ).filter((type) => !activeTypes.has(type));

  return (
    <div className="space-y-2.5">
      {/* Active goals */}
      {active.length === 0 ? (
        <div className="border-border rounded-xl border border-dashed p-5 text-center">
          <Target
            className="text-muted-foreground mx-auto mb-1.5 size-5"
            aria-hidden
          />
          <p className="text-foreground text-sm font-medium">No goals yet</p>
          <p className="text-muted-foreground text-xs">
            Set a target below — reaching it pays +200 XP.
          </p>
        </div>
      ) : (
        <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
          {active.map((goal) => {
            const meta = GOAL_TYPE_META[goal.goal_type];
            return (
              <div key={goal.id} className="space-y-2 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-foreground text-sm font-semibold">
                    {meta.label}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      → {goal.target_value}
                      {meta.unit}
                    </span>
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive-outline"
                    onClick={() => setConfirmGoal(goal)}
                  >
                    Remove
                  </Button>
                </div>
                {goal.progress ? (
                  <>
                    <Progress value={goal.progress.pct} />
                    <p className="text-muted-foreground text-xs">
                      {goal.current}
                      {meta.unit} now · {goal.progress.pct}% there
                      {goal.target_date
                        ? ` · by ${new Date(
                            `${goal.target_date}T00:00:00`,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}`
                        : ""}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {SOURCE_HINTS[meta.source] ??
                      "Log a measurement to start tracking."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recently achieved */}
      {achieved.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {achieved.map((goal) => {
            const meta = GOAL_TYPE_META[goal.goal_type];
            return (
              <Badge key={goal.id} variant="success">
                <Trophy aria-hidden />
                {meta.label} {goal.target_value}
                {meta.unit}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Create */}
      {availableTypes.length > 0 && (
        <form
          action={createAction}
          className="bg-card border-border flex flex-wrap items-end gap-3 rounded-xl border p-4"
        >
          <div className="min-w-40 flex-1 space-y-1.5">
            <Label htmlFor="goal_type">New goal</Label>
            <select
              id="goal_type"
              name="goal_type"
              required
              defaultValue=""
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
            >
              <option value="" disabled>
                Pick a metric
              </option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {GOAL_TYPE_META[type].label} ({GOAL_TYPE_META[type].unit})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-24 flex-1 space-y-1.5">
            <Label htmlFor="target_value">Target</Label>
            <Input
              id="target_value"
              name="target_value"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0.1}
              required
              placeholder="70"
            />
          </div>
          <div className="min-w-32 flex-1 space-y-1.5">
            <Label htmlFor="target_date">By (optional)</Label>
            <Input id="target_date" name="target_date" type="date" />
          </div>
          <Button type="submit" variant="brand" disabled={creating}>
            {creating ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Set goal
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={confirmGoal !== null}
        title={
          confirmGoal
            ? `Remove your ${GOAL_TYPE_META[confirmGoal.goal_type].label.toLowerCase()} goal?`
            : ""
        }
        description="Progress is kept, but this goal stops tracking and won't pay XP."
        confirmLabel="Remove goal"
        pending={abandoning}
        onCancel={() => setConfirmGoal(null)}
        onConfirm={() => {
          if (!confirmGoal) return;
          const formData = new FormData();
          formData.set("goal_id", confirmGoal.id);
          abandonAction(formData);
          setConfirmGoal(null);
        }}
      />
    </div>
  );
}
