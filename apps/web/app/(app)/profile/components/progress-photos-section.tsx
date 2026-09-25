"use client";

import { useRef, useState } from "react";
import { Camera, GitCompareArrows, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/client-image";
import { useDeletePhoto, usePhotos, useUploadPhotos } from "../hooks/use-profile";
import { comparePair, photoMonthLabel, toggleCompare } from "../lib/photos";
import { PhotoTile, TileRemoveButton } from "./photo-tile";

/** The private then-vs-now journal (max 24): add one at a time, compare two side by side. */
export function ProgressPhotosSection() {
  const { progress } = usePhotos();
  const input = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const upload = useUploadPhotos();
  const remove = useDeletePhoto();
  const pair = comparing ? comparePair(progress, selected) : null;

  const picked = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      upload.upload([await compressImage(file)], "progress");
    } catch {
      toast.error("Could not read that image");
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className='bg-card border-border space-y-3 rounded-xl border p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-foreground text-sm font-semibold'>Progress photos</p>
        <div className='flex items-center gap-2'>
          {progress.length >= 2 && (
            <Button
              type='button'
              variant={comparing ? "secondary" : "ghost"}
              size='sm'
              onClick={() => {
                setComparing((on) => !on);
                setSelected([]);
              }}>
              {comparing ? <X aria-hidden /> : <GitCompareArrows aria-hidden />}
              {comparing ? "Done" : "Compare"}
            </Button>
          )}
          <input
            ref={input}
            type='file'
            accept='image/jpeg,image/png,image/webp'
            aria-label='Progress photo'
            className='sr-only'
            onChange={(e) => {
              void picked(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            type='button'
            variant='secondary'
            size='sm'
            disabled={upload.isPending || preparing}
            onClick={() => input.current?.click()}>
            {upload.isPending || preparing ? <Loader2 className='animate-spin' aria-hidden /> : <Camera aria-hidden />}
            {upload.isPending || preparing ? "Uploading…" : "Add photo"}
          </Button>
        </div>
      </div>
      <p className='text-muted-foreground text-xs'>
        {comparing
          ? "Pick two photos to compare."
          : "A private then-vs-now journal — one photo every few weeks is plenty. Images are re-encoded (location data stripped) and screened before saving."}
      </p>

      {progress.length === 0 ? (
        <p className='text-muted-foreground text-sm'>
          No progress photos yet — take the first one today; you&apos;ll thank yourself in eight weeks.
        </p>
      ) : (
        <ul className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
          {progress.map((photo) => {
            const alt = `Progress photo, ${photoMonthLabel(photo.createdAt)}`;
            return (
              <li key={photo.id}>
                {comparing ? (
                  <button
                    type='button'
                    onClick={() => setSelected((current) => toggleCompare(current, photo.id))}
                    aria-pressed={selected.includes(photo.id)}
                    className='block w-full'>
                    <PhotoTile id={photo.id} alt={alt} selected={selected.includes(photo.id)} />
                  </button>
                ) : (
                  <PhotoTile id={photo.id} alt={alt}>
                    <TileRemoveButton
                      label='Delete photo'
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ params: { path: { id: photo.id } } })}
                    />
                  </PhotoTile>
                )}
                <p className='text-muted-foreground mt-1 text-center text-[11px]'>{photoMonthLabel(photo.createdAt)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {pair && (
        <div className='grid grid-cols-2 gap-2'>
          {pair.map((photo) => (
            <figure key={photo.id}>
              <PhotoTile id={photo.id} alt={`Progress photo, ${photoMonthLabel(photo.createdAt)}`} />
              <figcaption className='text-muted-foreground mt-1 text-center text-xs'>
                {photoMonthLabel(photo.createdAt)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
