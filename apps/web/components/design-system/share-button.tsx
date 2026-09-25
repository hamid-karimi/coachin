"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { ShareCardSheet } from "@/components/design-system/share-card-sheet";
import { Button } from "@/components/ui/button";
import type { ShareCardData } from "@/lib/share-card";

interface ShareButtonProps {
  data: ShareCardData;
  /** Button text, or the icon-only button's accessible name. */
  label: string;
  /** A compact icon button (list rows). */
  iconOnly?: boolean;
}

/** Opens the share-card sheet for one card. */
export function ShareButton({ data, label, iconOnly = false }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {iconOnly ? (
        <button
          type='button'
          aria-label={label}
          onClick={() => setOpen(true)}
          className='text-muted-foreground hover:bg-secondary hover:text-foreground grid size-6 place-items-center rounded-md transition-colors'>
          <Share2 className='size-3.5' aria-hidden />
        </button>
      ) : (
        <Button type='button' variant='ghost' size='sm' className='-ml-2' onClick={() => setOpen(true)}>
          <Share2 aria-hidden />
          {label}
        </Button>
      )}
      {open && <ShareCardSheet open onClose={() => setOpen(false)} data={data} />}
    </>
  );
}
