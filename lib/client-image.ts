"use client";

/**
 * Browser-side image compression shared by photo-upload features.
 * Downscales to ≤1600px and steps JPEG quality down until ≤~1MB.
 * Canvas re-encoding also drops EXIF metadata before anything uploads.
 */

const TARGET_BYTES = 1024 * 1024;
const MAX_EDGE = 1600;

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of [0.82, 0.7, 0.6, 0.5]) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error("compression failed");

  const name = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}
