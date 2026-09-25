"use client";

/**
 * Browser-side image compression for photo uploads: downscales to ≤1600px and
 * steps JPEG quality down until ≤~1MB. Re-encoding through a canvas also drops
 * EXIF metadata (location!) before anything leaves the device.
 */

const TARGET_BYTES = 1024 * 1024;
const MAX_EDGE = 1600;
const QUALITIES = [0.82, 0.7, 0.6, 0.5];

/** The downscaled size: the longest edge at most 1600px, never upscaled. */
export function scaledSize(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** "IMG_0042.HEIC" → "IMG_0042.jpg" */
export function jpegName(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
}

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const size = scaledSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of QUALITIES) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("compression failed");
  return new File([blob], jpegName(file.name), { type: "image/jpeg" });
}
