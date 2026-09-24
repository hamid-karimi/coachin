"use client";

import { useActionState, useRef, useState } from "react";
import { Camera, GitCompareArrows, Loader2, Share2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { progressShareCard } from "@/lib/share-card";
import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import { ShareCardSheet } from "@/components/share/ShareCardSheet";
import {
  deleteBodyPhotoAction,
  uploadProgressPhotoAction,
  type BodyPhotosActionState,
} from "../body-photos-actions";
import type { BodyPhotoItem } from "./body-photos-section";

const initialState: BodyPhotosActionState = {};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function weeksBetween(fromIso: string, toIso: string): number {
  const ms = Math.abs(new Date(toIso).getTime() - new Date(fromIso).getTime());
  return Math.max(1, Math.round(ms / (7 * 24 * 60 * 60 * 1000)));
}

function DeletePhotoButton({ photoId }: { photoId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteBodyPhotoAction,
    initialState,
  );
  useActionToast(state);
  return (
    <form action={formAction} className="absolute top-1 right-1">
      <input type="hidden" name="photo_id" value={photoId} />
      <button
        type="submit"
        disabled={pending}
        aria-label="Delete progress photo"
        className="bg-background/80 text-muted-foreground hover:text-destructive grid size-6 place-items-center rounded-md transition-colors"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <Trash2 className="size-3.5" aria-hidden />
        )}
      </button>
    </form>
  );
}

/**
 * Occasional progress-photo journal (kind 'progress', max 24): timeline
 * grid, two-photo compare, and an explicit-consent share card. Private by
 * default — nothing leaves the account unless the user shares.
 */
export function ProgressPhotosSection({
  photos,
}: {
  photos: BodyPhotoItem[];
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadProgressPhotoAction,
    initialState,
  );
  useActionToast(uploadState);

  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [compareBlobs, setCompareBlobs] = useState<[Blob, Blob] | null>(null);
  const [preparingShare, setPreparingShare] = useState(false);

  const togglePhoto = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id].slice(-2),
    );

  const pair =
    selected.length === 2
      ? ([...selected]
          .map((id) => photos.find((photo) => photo.id === id))
          .filter(Boolean) as [BodyPhotoItem, BodyPhotoItem])
      : null;
  // Oldest photo on the left.
  const ordered = pair
    ? ([...pair].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ) as [BodyPhotoItem, BodyPhotoItem])
    : null;

  const onSharePair = async () => {
    if (!ordered || !ordered[0].url || !ordered[1].url) return;
    setPreparingShare(true);
    try {
      const [before, after] = await Promise.all(
        ordered.map(async (photo) => {
          const response = await fetch(photo.url as string);
          if (!response.ok) throw new Error("photo fetch failed");
          return response.blob();
        }),
      );
      setCompareBlobs([before, after]);
      setShareOpen(true);
    } catch {
      toast.error("Couldn't load the photos — try again");
    } finally {
      setPreparingShare(false);
    }
  };

  return (
    <div className="bg-card border-border space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground text-sm font-semibold">
          Progress photos
        </p>
        <div className="flex items-center gap-2">
          {photos.length >= 2 && (
            <Button
              type="button"
              variant={compareMode ? "secondary" : "ghost"}
              size="sm"
              onClick={() => {
                setCompareMode((current) => !current);
                setSelected([]);
              }}
            >
              {compareMode ? <X aria-hidden /> : <GitCompareArrows aria-hidden />}
              {compareMode ? "Done" : "Compare"}
            </Button>
          )}
          <form action={uploadAction}>
            <input
              ref={fileInputRef}
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => event.target.form?.requestSubmit()}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Camera aria-hidden />
              )}
              {uploading ? "Uploading…" : "Add photo"}
            </Button>
          </form>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        {compareMode
          ? "Pick two photos to compare."
          : "A private then-vs-now journal — one photo every few weeks is plenty. Images are re-encoded (location data stripped) and screened before saving."}
      </p>

      {photos.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No progress photos yet — take the first one today; you&apos;ll thank
          yourself in eight weeks.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((photo) => (
            <li key={photo.id} className="relative">
              <button
                type="button"
                disabled={!compareMode}
                aria-pressed={selected.includes(photo.id)}
                aria-label={`Progress photo from ${dateLabel(photo.created_at)}`}
                onClick={() => togglePhoto(photo.id)}
                className={cn(
                  "block w-full overflow-hidden rounded-lg",
                  compareMode && "cursor-pointer",
                  selected.includes(photo.id) && "ring-brand ring-3",
                )}
              >
                {photo.url ? (
                  // Signed, short-lived storage URL; next/image can't optimize it.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={`Progress photo, ${dateLabel(photo.created_at)}`}
                    className="aspect-3/4 w-full object-cover"
                  />
                ) : (
                  <div className="bg-secondary aspect-3/4 w-full" />
                )}
              </button>
              {!compareMode && <DeletePhotoButton photoId={photo.id} />}
              <p className="text-muted-foreground mt-1 text-center text-[11px]">
                {dateLabel(photo.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {compareMode && ordered && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            {ordered.map((photo) => (
              <figure key={photo.id}>
                {photo.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={`Progress photo, ${dateLabel(photo.created_at)}`}
                    className="aspect-3/4 w-full rounded-lg object-cover"
                  />
                )}
                <figcaption className="text-muted-foreground mt-1 text-center text-xs">
                  {dateLabel(photo.created_at)}
                </figcaption>
              </figure>
            ))}
          </div>
          <Button
            type="button"
            variant="brand"
            size="sm"
            disabled={preparingShare}
            onClick={onSharePair}
          >
            {preparingShare ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Share2 aria-hidden />
            )}
            Share progress
          </Button>
          <p className="text-muted-foreground text-xs">
            The shared image contains your photos — you choose where it goes.
          </p>
        </div>
      )}

      {ordered && compareBlobs && (
        <ShareCardSheet
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          comparePhotos={compareBlobs}
          data={progressShareCard({
            fromLabel: dateLabel(ordered[0].created_at),
            toLabel: dateLabel(ordered[1].created_at),
            weeksBetween: weeksBetween(
              ordered[0].created_at,
              ordered[1].created_at,
            ),
          })}
        />
      )}
    </div>
  );
}
