"use client";

import type { Dispatch } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PbKey, RunningAction, RunningDraft } from "../lib/running-wizard";
import { Field, SELECT_CLASS, WizardCard } from "./wizard-fields";

const PB_FIELDS: [PbKey, string, string][] = [
  ["pb_5k", "5k", "22:30"],
  ["pb_10k", "10k", "47:00"],
  ["pb_half", "Half", "1:45:00"],
  ["pb_full", "Marathon", "3:59:00"],
];

const DAYS = [2, 3, 4, 5, 6, 7];

/** Step 2: personal bests, current volume, days per week, injuries. */
export function RunningBackgroundStep({ draft, dispatch }: { draft: RunningDraft; dispatch: Dispatch<RunningAction> }) {
  return (
    <WizardCard>
      <p className='text-foreground text-sm font-semibold'>Personal bests (leave blank if none)</p>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {PB_FIELDS.map(([key, label, placeholder]) => (
          <Field key={key} id={key} label={label}>
            <Input
              id={key}
              placeholder={placeholder}
              value={draft.pbs[key]}
              onChange={(e) => dispatch({ type: "set_pb", key, value: e.target.value })}
            />
          </Field>
        ))}
      </div>

      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
        <Field id='weekly_km' label='Weekly km now'>
          <Input
            id='weekly_km'
            type='number'
            min={0}
            step='1'
            placeholder='30'
            value={draft.weeklyKm}
            onChange={(e) => dispatch({ type: "set", field: "weeklyKm", value: e.target.value })}
          />
        </Field>
        <Field id='longest_run_km' label='Longest recent run (km)'>
          <Input
            id='longest_run_km'
            type='number'
            min={0}
            step='1'
            placeholder='15'
            value={draft.longestRunKm}
            onChange={(e) => dispatch({ type: "set", field: "longestRunKm", value: e.target.value })}
          />
        </Field>
        <Field id='days_per_week' label='Training days / week'>
          <select
            id='days_per_week'
            value={draft.daysPerWeek}
            onChange={(e) => dispatch({ type: "set", field: "daysPerWeek", value: Number(e.target.value) })}
            className={SELECT_CLASS}>
            {DAYS.map((days) => (
              <option key={days} value={days}>
                {days}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field id='injuries' label='Injuries or limitations (optional)'>
        <Textarea
          id='injuries'
          rows={2}
          maxLength={500}
          placeholder='Example: right knee gets sore over 25km/week'
          value={draft.injuries}
          onChange={(e) => dispatch({ type: "set", field: "injuries", value: e.target.value })}
        />
      </Field>
    </WizardCard>
  );
}
