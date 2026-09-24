"use client";

import { useState } from "react";
import { Pill } from "lucide-react";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { useToday } from "../hooks/use-today";
import { dueChecklist } from "../lib/supplements";
import { AddSupplementForm } from "./add-supplement-form";
import { ManagedSupplementRow } from "./managed-supplement-row";
import { SupplementItem } from "./supplement-item";

/**
 * "Daily stack": today's due supplements to check off, plus a manage sheet
 * for the whole stack. Informational only — no XP, streaks, or hearts
 * (FORMULAS.md §13).
 */
export function SupplementsCard() {
  const { supplements } = useToday();
  const [manageOpen, setManageOpen] = useState(false);
  const { due, taken } = dueChecklist(supplements);

  return (
    <div className='bg-card border-border rounded-2xl border p-4'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
          <Pill className='text-brand-ink size-4' aria-hidden />
          Daily stack
        </h2>
        <div className='flex items-baseline gap-3'>
          {due.length > 0 && (
            <span className='text-muted-foreground text-[13px]'>
              {taken} of {due.length} taken
            </span>
          )}
          <button
            type='button'
            onClick={() => setManageOpen(true)}
            className='text-brand-ink text-[13px] font-medium hover:underline'>
            {supplements.length > 0 ? "Manage" : "Add"}
          </button>
        </div>
      </div>

      {supplements.length === 0 ? (
        <p className='text-muted-foreground mt-2 text-[13px]'>
          Track vitamins, creatine, whey — anything you take daily. Add your first supplement to see it here every
          day.
        </p>
      ) : due.length === 0 ? (
        <p className='text-muted-foreground mt-2 text-[13px]'>
          Nothing on today&apos;s schedule. Manage your stack to see everything.
        </p>
      ) : (
        <ul className='divide-border mt-1.5 divide-y'>
          {due.map((supplement) => (
            <SupplementItem key={supplement.id} supplement={supplement} />
          ))}
        </ul>
      )}

      <BottomSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        title='Daily stack'
        description='Supplements you take on a schedule — reminders only, no XP. Visible to your coach when nutrition sharing is on.'>
        <div className='space-y-4'>
          <AddSupplementForm />
          {supplements.length > 0 && (
            <div>
              <p className='text-overline mb-1'>Your stack</p>
              <ul className='divide-border divide-y'>
                {supplements.map((supplement) => (
                  <ManagedSupplementRow key={supplement.id} supplement={supplement} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
