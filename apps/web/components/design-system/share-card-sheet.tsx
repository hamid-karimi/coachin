"use client";

import { useRef } from "react";
import { Download, ImagePlus, Loader2, Share2 } from "lucide-react";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { canShareFile, saveFile, shareOrSave, useShareCard } from "@/components/hooks/use-share-card";
import { Button } from "@/components/ui/button";
import { shareCardAlt, type ShareCardData } from "@/lib/share-card";
import type { ShareCardFormat } from "@/lib/share-card-canvas";
import { cn } from "@/lib/utils";

const FORMATS: { value: ShareCardFormat; label: string; frame: string }[] = [
  { value: "story", label: "Story", frame: "aspect-9/16 max-h-105" },
  { value: "square", label: "Square", frame: "aspect-square max-h-80" },
];

interface ShareCardSheetProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
  /** Two-photo then-vs-now layout (progress cards); hides the photo picker. */
  comparePhotos?: readonly [Blob, Blob] | null;
}

/** Preview, then share (OS sheet) or save a card image. Nothing ever auto-posts. */
export function ShareCardSheet({ open, onClose, data, comparePhotos }: ShareCardSheetProps) {
  const card = useShareCard(open, data, comparePhotos);
  const input = useRef<HTMLInputElement>(null);
  const native = canShareFile(card.file);
  const frame = FORMATS.find((format) => format.value === card.format)?.frame;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title='Share it'
      description='Saved or shared only when you choose — nothing auto-posts.'>
      <div className='space-y-3'>
        <div role='radiogroup' aria-label='Card format' className='flex gap-1.5'>
          {FORMATS.map((format) => (
            <button
              key={format.value}
              type='button'
              role='radio'
              aria-checked={card.format === format.value}
              onClick={() => card.setFormat(format.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                card.format === format.value
                  ? "bg-brand border-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:border-brand/50",
              )}>
              {format.label}
            </button>
          ))}
        </div>
        <div className={cn("bg-secondary mx-auto overflow-hidden rounded-xl", frame)}>
          {card.previewUrl ? (
            // A canvas-made blob URL: next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.previewUrl} alt={shareCardAlt(data)} className='size-full object-contain' />
          ) : (
            <div className='grid size-full place-items-center'>
              <Loader2 className='text-muted-foreground animate-spin' aria-hidden />
            </div>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          {!comparePhotos && (
            <>
              <input
                ref={input}
                type='file'
                accept='image/jpeg,image/png,image/webp'
                aria-label='Card photo'
                className='sr-only'
                onChange={(e) => {
                  void card.pickPhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={card.busy}
                onClick={() => input.current?.click()}>
                <ImagePlus aria-hidden />
                {card.photo ? "Change photo" : "Add a photo"}
              </Button>
            </>
          )}
          <Button
            type='button'
            variant='brand'
            size='sm'
            disabled={card.busy || !card.file}
            onClick={() => card.file && shareOrSave(card.file)}>
            {native ? <Share2 aria-hidden /> : <Download aria-hidden />}
            {native ? "Share" : "Save image"}
          </Button>
          {native && (
            <Button
              type='button'
              variant='ghost'
              size='sm'
              disabled={card.busy || !card.file}
              onClick={() => card.file && saveFile(card.file)}>
              <Download aria-hidden />
              Save
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
