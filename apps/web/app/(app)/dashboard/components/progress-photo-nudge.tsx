"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { useToday } from "../hooks/use-today";

/** Quiet link toward the progress-photo journal; gone once a recent photo exists. */
export function ProgressPhotoNudge() {
  const { progressPhoto } = useToday();
  if (!progressPhoto.due) return null;
  return (
    <Link
      href='/profile'
      className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 px-0.5 text-xs transition-colors'>
      <Camera className='size-3.5' aria-hidden />
      {progressPhoto.hasPhotos
        ? "It's been a few weeks — add a progress photo"
        : "Start your progress-photo journal on your profile"}
    </Link>
  );
}
