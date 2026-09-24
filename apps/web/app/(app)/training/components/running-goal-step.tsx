"use client";

import type { Dispatch } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BASE_WEEK_OPTIONS, RACE_TARGETS, type RaceTarget } from "@/lib/running";
import { cn } from "@/lib/utils";
import {
  EXPERIENCE_LEVELS,
  hasAnyPb,
  needsCustomKm,
  suggestedGoal,
  targetKm,
  targetLabel,
  type RunningAction,
  type RunningDraft,
} from "../lib/running-wizard";
import { Field, SELECT_CLASS, WizardCard } from "./wizard-fields";

const MODES = [
  ["base", "Just start running"],
  ["race", "Train for a race"],
] as const;

/** Step 3: base-building vs race, and the matching fields. */
export function RunningGoalStep({ draft, dispatch }: { draft: RunningDraft; dispatch: Dispatch<RunningAction> }) {
  const race = draft.mode === "race";
  const canSuggest = hasAnyPb(draft) && targetKm(draft) !== null;

  return (
    <WizardCard>
      <div role='radiogroup' aria-label='What are you running for?' className='bg-secondary flex gap-1 rounded-lg p-1'>
        {MODES.map(([value, label]) => (
          <button
            key={value}
            type='button'
            role='radio'
            aria-checked={draft.mode === value}
            onClick={() => dispatch({ type: "set", field: "mode", value })}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              draft.mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}>
            {label}
          </button>
        ))}
      </div>

      {race ? (
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
          <Field id='race_target' label='Race distance'>
            <select
              id='race_target'
              value={draft.raceTarget}
              onChange={(e) => dispatch({ type: "set", field: "raceTarget", value: e.target.value as RaceTarget })}
              className={SELECT_CLASS}>
              {RACE_TARGETS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>
          {needsCustomKm(draft.raceTarget) && (
            <Field id='custom_distance_km' label='Distance (km)'>
              <Input
                id='custom_distance_km'
                type='number'
                min={1}
                max={500}
                step='0.1'
                placeholder={draft.raceTarget === "ultra" ? "50" : "25"}
                value={draft.customKm}
                onChange={(e) => dispatch({ type: "set", field: "customKm", value: e.target.value })}
              />
            </Field>
          )}
        </div>
      ) : (
        <Field id='base_weeks' label='Program length'>
          <select
            id='base_weeks'
            value={draft.baseWeeks}
            onChange={(e) => dispatch({ type: "set", field: "baseWeeks", value: Number(e.target.value) })}
            className={SELECT_CLASS}>
            {BASE_WEEK_OPTIONS.map((weeks) => (
              <option key={weeks} value={weeks}>
                {weeks} weeks
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field id='experience_level' label='Where are you on your running journey?'>
        <select
          id='experience_level'
          value={draft.experienceLevel}
          onChange={(e) => dispatch({ type: "set", field: "experienceLevel", value: e.target.value })}
          className={SELECT_CLASS}>
          {EXPERIENCE_LEVELS.map(([value, label, hint]) => (
            <option key={value} value={value}>
              {label} — {hint}
            </option>
          ))}
        </select>
      </Field>

      {race ? (
        <>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <Field id='race_date' label='Race date'>
              <Input
                id='race_date'
                type='date'
                value={draft.raceDate}
                onChange={(e) => dispatch({ type: "set", field: "raceDate", value: e.target.value })}
              />
            </Field>
            <Field id='goal_time' label='Goal time (optional)'>
              <div className='flex gap-2'>
                <Input
                  id='goal_time'
                  placeholder={draft.raceTarget === "5k" ? "25:00" : "3:59:00"}
                  value={draft.goalTime}
                  onChange={(e) => dispatch({ type: "set", field: "goalTime", value: e.target.value })}
                />
                <Button
                  type='button'
                  variant='outline'
                  disabled={!canSuggest}
                  onClick={() => {
                    const goal = suggestedGoal(draft);
                    if (goal) dispatch({ type: "set", field: "goalTime", value: goal });
                  }}
                  title={
                    hasAnyPb(draft)
                      ? "Suggest from your PBs (Riegel formula)"
                      : "Add a personal best in the previous step to get a suggestion"
                  }>
                  <Wand2 aria-hidden />
                  Suggest
                </Button>
              </div>
            </Field>
          </div>
          <p className='text-muted-foreground text-xs'>
            First {targetLabel(draft.raceTarget).toLowerCase()}? Leave the goal time empty — the plan will target a
            strong, healthy finish instead of a time.
          </p>
        </>
      ) : (
        <p className='text-muted-foreground text-xs'>
          No race, no pressure — this builds an easy, consistent running habit with gentle progression, strength, and
          mobility.
        </p>
      )}
    </WizardCard>
  );
}
