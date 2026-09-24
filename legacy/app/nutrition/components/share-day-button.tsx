"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

import { dayShareCard } from "@/lib/share-card";
import { Button } from "@/components/ui/button";
import { ShareCardSheet } from "@/components/share/ShareCardSheet";

interface ShareDayButtonProps {
  kcal: number;
  proteinG: number;
  mealsCount: number;
}

/** "Share today" on the nutrition day summary — additive stats only
 *  (never targets or deficits; see lib/share-card.ts privacy rules). */
export function ShareDayButton({
  kcal,
  proteinG,
  mealsCount,
}: ShareDayButtonProps) {
  const [open, setOpen] = useState(false);
  if (kcal <= 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Share2 aria-hidden />
        Share today
      </Button>
      <ShareCardSheet
        open={open}
        onClose={() => setOpen(false)}
        data={dayShareCard({ kcal, proteinG, mealsCount })}
      />
    </>
  );
}
