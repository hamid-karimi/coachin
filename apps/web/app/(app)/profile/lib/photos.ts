import type { components } from "@/lib/api/schema";

export type PhotoItem = components["schemas"]["PhotoBody"];

/** Legacy caps, enforced by the API too. */
export const MAX_BATCH = 5;
export const MAX_PROGRESS_PHOTOS = 24;

/** Photos stream from the API (storage is private). */
export function photoUrl(id: string): string {
  return `/api/v1/photos/${id}`;
}

/** "Sep 2026" */
export function photoMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** "Sep 25" */
export function photoDayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** The multipart upload: files under "photos", plus the set. */
export function photosForm(files: File[], set: "body" | "progress"): FormData {
  const form = new FormData();
  for (const file of files) form.append("photos", file);
  form.set("set", set);
  return form;
}

/** Tap to pick; a third pick drops the oldest pick (at most two). */
export function toggleCompare(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id].slice(-2);
}

/** The two picked photos, oldest on the left; null until two are picked. */
export function comparePair(photos: PhotoItem[], selected: string[]): [PhotoItem, PhotoItem] | null {
  const picked = photos.filter((photo) => selected.includes(photo.id));
  if (picked.length !== 2) return null;
  const [a, b] = picked;
  return a.createdAt <= b.createdAt ? [a, b] : [b, a];
}

/** "2 selected" button copy: "Upload 3" / "Upload". */
export function uploadLabel(count: number): string {
  return count > 0 ? `Upload ${count}` : "Upload";
}
