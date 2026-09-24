"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Pencil, Pill, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  scheduleLabel,
  type SupplementScheduleType,
} from "@/lib/supplement-schedule";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSupplementAction,
  deleteSupplementAction,
  toggleSupplementLogAction,
  updateSupplementScheduleAction,
  type SupplementActionState,
} from "../supplements-actions";

const initialState: SupplementActionState = {};

export type SupplementRow = {
  id: string;
  name: string;
  dose: string | null;
  scheduleType: SupplementScheduleType;
  daysOfWeek: number[] | null;
  /** Due today — computed in the page from the schedule + training day. */
  due: boolean;
};

const SCHEDULE_OPTIONS: { value: SupplementScheduleType; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "training_days", label: "Training days" },
  { value: "custom", label: "Custom" },
];

/** 0=Sun … 6=Sat, matching plan_items.day_of_week. */
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// Native <select> styled to match the Input primitive (design-system tokens).
const selectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/25 flex h-11 w-full rounded-md border px-3.5 py-1 text-base transition-colors outline-none focus-visible:ring-[3px] md:text-[15px]";

/** Schedule picker: a type select plus weekday checkboxes shown only for
 *  custom. Presentational — the enclosing <form> submits the values. */
function ScheduleFields({
  idPrefix,
  defaultScheduleType,
  defaultDays,
}: {
  idPrefix: string;
  defaultScheduleType: SupplementScheduleType;
  defaultDays: number[] | null;
}) {
  const [scheduleType, setScheduleType] =
    useState<SupplementScheduleType>(defaultScheduleType);
  const selectedDays = new Set(defaultDays ?? []);

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-schedule`}>Schedule</Label>
        <select
          id={`${idPrefix}-schedule`}
          name="schedule_type"
          value={scheduleType}
          onChange={(event) =>
            setScheduleType(event.target.value as SupplementScheduleType)
          }
          className={selectClassName}
        >
          {SCHEDULE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {scheduleType === "custom" && (
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="text-muted-foreground mb-1 text-xs">
            Days of the week
          </legend>
          {WEEKDAYS.map((weekday) => (
            <label
              key={weekday.value}
              className="border-border text-muted-foreground has-[:checked]:bg-brand has-[:checked]:border-brand has-[:checked]:text-brand-foreground flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
            >
              <input
                type="checkbox"
                name="days_of_week"
                value={weekday.value}
                defaultChecked={selectedDays.has(weekday.value)}
                className="sr-only"
              />
              {weekday.label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

function SupplementItem({
  supplement,
  taken,
}: {
  supplement: SupplementRow;
  taken: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    toggleSupplementLogAction,
    initialState,
  );
  useActionToast(state);

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p
          className={cn(
            "text-foreground truncate text-sm",
            taken && "text-muted-foreground line-through",
          )}
        >
          {supplement.name}
        </p>
        {supplement.dose && (
          <p className="text-muted-foreground text-xs">{supplement.dose}</p>
        )}
      </div>
      <form action={formAction}>
        <input type="hidden" name="supplement_id" value={supplement.id} />
        <input type="hidden" name="taken" value={taken ? "false" : "true"} />
        <button
          type="submit"
          disabled={pending}
          aria-pressed={taken}
          aria-label={
            taken
              ? `Mark ${supplement.name} as not taken`
              : `Mark ${supplement.name} as taken`
          }
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full border transition-colors",
            taken
              ? "bg-brand border-brand text-brand-foreground"
              : "border-border text-muted-foreground hover:border-brand/50",
          )}
        >
          <Check className="size-3.5" aria-hidden />
        </button>
      </form>
    </li>
  );
}

/** Inline schedule editor for a managed supplement row. */
function SupplementScheduleEditor({
  supplement,
  onSaved,
}: {
  supplement: SupplementRow;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    updateSupplementScheduleAction,
    initialState,
  );
  useActionToast(state);
  useEffect(() => {
    if (state.success) onSaved();
    // Collapse once the update lands; onSaved identity is stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="mt-2 space-y-3">
      <input type="hidden" name="supplement_id" value={supplement.id} />
      <ScheduleFields
        idPrefix={`edit-${supplement.id}`}
        defaultScheduleType={supplement.scheduleType}
        defaultDays={supplement.daysOfWeek}
      />
      <Button type="submit" variant="brand" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save schedule"}
      </Button>
    </form>
  );
}

function ManagedSupplementRow({ supplement }: { supplement: SupplementRow }) {
  const [state, formAction, pending] = useActionState(
    deleteSupplementAction,
    initialState,
  );
  useActionToast(state);
  const [editing, setEditing] = useState(false);

  return (
    <li className="py-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm">
            {supplement.name}
            {supplement.dose && (
              <span className="text-muted-foreground"> · {supplement.dose}</span>
            )}
          </p>
          <p className="text-muted-foreground text-xs">
            {scheduleLabel(supplement)}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEditing((open) => !open)}
            aria-expanded={editing}
            aria-label={`Edit ${supplement.name} schedule`}
          >
            <Pencil aria-hidden />
          </Button>
          <form action={formAction}>
            <input type="hidden" name="supplement_id" value={supplement.id} />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={pending}
              aria-label={`Remove ${supplement.name}`}
            >
              <Trash2 aria-hidden />
            </Button>
          </form>
        </div>
      </div>
      {editing && (
        <SupplementScheduleEditor
          supplement={supplement}
          onSaved={() => setEditing(false)}
        />
      )}
    </li>
  );
}

function AddSupplementForm() {
  const [state, formAction, pending] = useActionState(
    addSupplementAction,
    initialState,
  );
  useActionToast(state);

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="supplement-name">Name</Label>
        <Input
          id="supplement-name"
          name="name"
          maxLength={60}
          placeholder="Creatine"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="supplement-dose">Dose (optional)</Label>
        <Input
          id="supplement-dose"
          name="dose"
          maxLength={40}
          placeholder="5g after training"
        />
      </div>
      <ScheduleFields
        idPrefix="add"
        defaultScheduleType="daily"
        defaultDays={null}
      />
      <Button type="submit" variant="brand" size="sm" disabled={pending}>
        <Plus aria-hidden />
        {pending ? "Adding…" : "Add supplement"}
      </Button>
    </form>
  );
}

interface SupplementsCardProps {
  supplements: SupplementRow[];
  /** supplement ids already logged today. */
  takenIds: string[];
}

/** "Daily stack": reminder + logger for supplements as a daily habit.
 *  Informational only — no XP, streaks, or hearts (FORMULAS.md §13). */
export function SupplementsCard({
  supplements,
  takenIds,
}: SupplementsCardProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const taken = new Set(takenIds);
  // Checklist + tally only cover supplements due today; the rest live in Manage.
  const dueSupplements = supplements.filter((row) => row.due);
  const takenCount = dueSupplements.filter((row) => taken.has(row.id)).length;

  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <Pill className="text-brand-ink size-4" aria-hidden />
          Daily stack
        </h2>
        <div className="flex items-baseline gap-3">
          {dueSupplements.length > 0 && (
            <span className="text-muted-foreground text-[13px]">
              {takenCount} of {dueSupplements.length} taken
            </span>
          )}
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="text-brand-ink text-[13px] font-medium hover:underline"
          >
            {supplements.length > 0 ? "Manage" : "Add"}
          </button>
        </div>
      </div>

      {supplements.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-[13px]">
          Track vitamins, creatine, whey — anything you take daily. Add your
          first supplement to see it here every day.
        </p>
      ) : dueSupplements.length === 0 ? (
        <p className="text-muted-foreground mt-2 text-[13px]">
          Nothing on today&apos;s schedule. Manage your stack to see everything.
        </p>
      ) : (
        <ul className="divide-border mt-1.5 divide-y">
          {dueSupplements.map((supplement) => (
            <SupplementItem
              key={supplement.id}
              supplement={supplement}
              taken={taken.has(supplement.id)}
            />
          ))}
        </ul>
      )}

      <BottomSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Daily stack"
        description="Supplements you take on a schedule — reminders only, no XP. Visible to your coach when nutrition sharing is on."
      >
        <div className="space-y-4">
          <AddSupplementForm />
          {supplements.length > 0 && (
            <div>
              <p className="text-overline mb-1">Your stack</p>
              <ul className="divide-border divide-y">
                {supplements.map((supplement) => (
                  <ManagedSupplementRow
                    key={supplement.id}
                    supplement={supplement}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
