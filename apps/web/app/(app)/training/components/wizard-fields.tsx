import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

// Native controls styled like the Input primitive (design-system tokens).
export const SELECT_CLASS =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]";

export const TEXTAREA_CLASS =
  "border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-[3px]";

/** Label above a control. */
export function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className='space-y-1.5'>
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/** A card section of a wizard step. */
export function WizardCard({ children }: { children: ReactNode }) {
  return <div className='bg-card border-border space-y-4 rounded-xl border p-4'>{children}</div>;
}
