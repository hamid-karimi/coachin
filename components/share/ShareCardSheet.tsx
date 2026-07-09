"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImagePlus, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import type { ShareCardData } from "@/lib/share-card";
import { compressImage } from "@/lib/client-image";
import {
  renderShareCard,
  type ShareCardFormat,
} from "./share-card-canvas";
import { BottomSheet } from "@/components/design-system/bottom-sheet";
import { Button } from "@/components/ui/button";

const FORMAT_OPTIONS: { value: ShareCardFormat; label: string }[] = [
  { value: "story", label: "Story" },
  { value: "square", label: "Square" },
];

interface ShareCardSheetProps {
  open: boolean;
  onClose: () => void;
  data: ShareCardData;
  /** Two-photo compare mode (progress cards) — hides the photo picker. */
  comparePhotos?: [Blob, Blob] | null;
}

/** Preview + share/download a canvas-composed card. Nothing auto-posts:
 *  sharing always goes through the OS share sheet or an explicit save. */
export function ShareCardSheet({
  open,
  onClose,
  data,
  comparePhotos,
}: ShareCardSheetProps) {
  const [format, setFormat] = useState<ShareCardFormat>("story");
  const [photo, setPhoto] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Only the first render shows a skeleton; afterwards the previous preview
  // stays visible while the next one draws (renders take ~a frame).
  const [busy, setBusy] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Re-render the card whenever inputs change while open. State updates
  // happen only in the promise callbacks (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    renderShareCard(data, { format, photo, comparePhotos })
      .then((rendered) => {
        if (cancelled) return;
        setFile(rendered);
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(rendered);
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't build the image — try again");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, format, photo, comparePhotos]);

  const onPickPhoto = async (list: FileList | null) => {
    const picked = list?.[0];
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (!picked) return;
    try {
      setPhoto(await compressImage(picked));
    } catch {
      toast.error("Could not read that image");
    }
  };

  const onShare = async () => {
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch {
        // user cancelled the OS sheet — nothing to do
        return;
      }
    }
    downloadFile(file);
  };

  const canNativeShare =
    typeof navigator !== "undefined" &&
    Boolean(file && navigator.canShare?.({ files: [file] }));

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Share it"
      description="Saved or shared only when you choose — nothing auto-posts."
    >
      <div className="space-y-3">
        <div
          role="radiogroup"
          aria-label="Card format"
          className="flex gap-1.5"
        >
          {FORMAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={format === option.value}
              onClick={() => setFormat(option.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                format === option.value
                  ? "bg-brand border-brand text-brand-foreground"
                  : "border-border text-muted-foreground hover:border-brand/50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            "bg-secondary mx-auto overflow-hidden rounded-xl",
            format === "story" ? "aspect-9/16 max-h-105" : "aspect-square max-h-80",
          )}
        >
          {previewUrl ? (
            // Canvas-generated preview; next/image adds nothing for a blob URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`Share card preview: ${data.headline}${data.stats.map((stat) => `, ${stat.value} ${stat.label}`).join("")}`}
              className="size-full object-contain"
            />
          ) : (
            <div className="grid size-full place-items-center">
              <Loader2 className="text-muted-foreground animate-spin" aria-hidden />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!comparePhotos && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => onPickPhoto(event.target.files)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => photoInputRef.current?.click()}
              >
                <ImagePlus aria-hidden />
                {photo ? "Change photo" : "Add a photo"}
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={busy || !file}
            onClick={onShare}
          >
            {canNativeShare ? <Share2 aria-hidden /> : <Download aria-hidden />}
            {canNativeShare ? "Share" : "Save image"}
          </Button>
          {canNativeShare && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy || !file}
              onClick={() => file && downloadFile(file)}
            >
              <Download aria-hidden />
              Save
            </Button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  URL.revokeObjectURL(url);
}
