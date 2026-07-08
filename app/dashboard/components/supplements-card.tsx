"use client";

import { useActionState, useState } from "react";
import { Check, Pill, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addSupplementAction,
  deleteSupplementAction,
  toggleSupplementLogAction,
  type SupplementActionState,
} from "../supplements-actions";

const initialState: SupplementActionState = {};

export type SupplementRow = {
  id: string;
  name: string;
  dose: string | null;
};

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

function ManagedSupplementRow({ supplement }: { supplement: SupplementRow }) {
  const [state, formAction, pending] = useActionState(
    deleteSupplementAction,
    initialState,
  );
  useActionToast(state);

  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <p className="text-foreground min-w-0 truncate text-sm">
        {supplement.name}
        {supplement.dose && (
          <span className="text-muted-foreground"> · {supplement.dose}</span>
        )}
      </p>
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
  const takenCount = supplements.filter((row) => taken.has(row.id)).length;

  return (
    <div className="bg-card border-border rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
          <Pill className="text-brand-ink size-4" aria-hidden />
          Daily stack
        </h2>
        <div className="flex items-baseline gap-3">
          {supplements.length > 0 && (
            <span className="text-muted-foreground text-[13px]">
              {takenCount} of {supplements.length} taken
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
      ) : (
        <ul className="divide-border mt-1.5 divide-y">
          {supplements.map((supplement) => (
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
        description="Supplements you take every day — reminders only, no XP."
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
