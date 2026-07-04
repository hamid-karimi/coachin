"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  analyzeBodyPhotos,
  extractReportMetrics,
  moderateBodyImage,
  type ReportMetrics,
} from "@/lib/ai/gemini";
import type { ProfileActionState } from "./actions";

export type BodyPhotosActionState = ProfileActionState & {
  /** Metrics extracted from a report photo, pending user confirmation. */
  reportMetrics?: ReportMetrics;
};

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_BODY_PHOTOS = 5;
const MAX_REPORTS = 3;
const BUCKET = "body-photos";

/**
 * Upload pipeline: validate → sharp re-encode (strips EXIF/GPS, caps size)
 * → Gemini moderation gate → storage + metadata row. Rejected images are
 * never written to storage.
 */
export async function uploadBodyPhotoAction(
  _prevState: BodyPhotosActionState,
  formData: FormData,
): Promise<BodyPhotosActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload" };
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { error: "Use a JPEG, PNG, or WebP image" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Image must be 5MB or smaller" };
  }

  const supabase = await createClient();

  // Cheap cap check BEFORE spending an AI call.
  const { count: photoCount } = await supabase
    .from("body_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "body_photo");
  const { count: reportCount } = await supabase
    .from("body_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "analysis_report");

  if ((photoCount ?? 0) >= MAX_BODY_PHOTOS && (reportCount ?? 0) >= MAX_REPORTS) {
    return { error: `Limit reached: ${MAX_BODY_PHOTOS} photos and ${MAX_REPORTS} reports` };
  }

  // Re-encode: drops EXIF/GPS metadata, normalizes orientation and size.
  let jpeg: Buffer;
  try {
    const original = Buffer.from(await file.arrayBuffer());
    jpeg = await sharp(original)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (error) {
    console.error("Image re-encode failed:", error);
    return { error: "Could not read that image — try a different file" };
  }

  // Moderation gate (disclosed in the upload UI).
  const moderation = await moderateBodyImage(
    jpeg.toString("base64"),
    "image/jpeg",
  );
  if (!moderation.ok) {
    return { error: moderation.reason };
  }

  const kind = moderation.category === "analysis_report"
    ? "analysis_report"
    : "body_photo";
  if (kind === "body_photo" && (photoCount ?? 0) >= MAX_BODY_PHOTOS) {
    return { error: `You already have ${MAX_BODY_PHOTOS} photos — delete one first` };
  }
  if (kind === "analysis_report" && (reportCount ?? 0) >= MAX_REPORTS) {
    return { error: `You already have ${MAX_REPORTS} reports — delete one first` };
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, jpeg, { contentType: "image/jpeg" });

  if (uploadError) {
    console.error("Storage upload failed:", uploadError);
    return { error: "Failed to store the image" };
  }

  const { error: insertError } = await supabase.from("body_photos").insert({
    user_id: user.id,
    storage_path: storagePath,
    kind,
  });

  if (insertError) {
    // Keep storage consistent with metadata.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    console.error("body_photos insert failed:", insertError);
    return { error: "Failed to save the photo" };
  }

  revalidatePath("/profile");
  return {
    success: true,
    message:
      kind === "analysis_report"
        ? "Report uploaded — extract its metrics below."
        : "Photo uploaded.",
    status: "success",
  };
}

export async function deleteBodyPhotoAction(
  _prevState: BodyPhotosActionState,
  formData: FormData,
): Promise<BodyPhotosActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const photoId = String(formData.get("photo_id") ?? "").trim();
  if (!photoId) return { error: "Missing photo id" };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("body_photos")
    .select("id, storage_path")
    .eq("id", photoId)
    .eq("user_id", user.id)
    .single();

  if (!photo) return { error: "Photo not found" };

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([photo.storage_path]);
  if (storageError) {
    console.error("Storage delete failed:", storageError);
  }

  const { error } = await supabase
    .from("body_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", user.id);

  if (error) {
    console.error("body_photos delete failed:", error);
    return { error: "Failed to delete the photo" };
  }

  revalidatePath("/profile");
  return { success: true, message: "Photo deleted.", status: "info" };
}

async function downloadAsBase64(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) {
    console.error("Storage download failed:", error);
    return null;
  }
  return Buffer.from(await data.arrayBuffer()).toString("base64");
}

/**
 * Consent-gated analysis: records consent on first run, sends all progress
 * photos in ONE Gemini call, stores the combined result on the newest photo.
 */
export async function analyzePhotosAction(
  _prevState: BodyPhotosActionState,
  formData: FormData,
): Promise<BodyPhotosActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  if (formData.get("consent") !== "on") {
    return { error: "Tick the consent box to run AI analysis" };
  }

  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ ai_photo_consent_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("ai_photo_consent_at", null);

  const { data: photos } = await supabase
    .from("body_photos")
    .select("id, storage_path")
    .eq("user_id", user.id)
    .eq("kind", "body_photo")
    .order("created_at", { ascending: false })
    .limit(MAX_BODY_PHOTOS);

  if (!photos || photos.length === 0) {
    return { error: "Upload at least one body photo first" };
  }

  const images: { base64: string; mimeType: string }[] = [];
  for (const photo of photos) {
    const base64 = await downloadAsBase64(supabase, photo.storage_path);
    if (base64) images.push({ base64, mimeType: "image/jpeg" });
  }
  if (images.length === 0) {
    return { error: "Could not read your photos — try again" };
  }

  const analysis = await analyzeBodyPhotos(images);
  if ("error" in analysis) {
    return { error: analysis.error };
  }

  const { error } = await supabase
    .from("body_photos")
    .update({ analysis, analyzed_at: new Date().toISOString() })
    .eq("id", photos[0].id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Saving analysis failed:", error);
    return { error: "Analysis succeeded but saving failed — try again" };
  }

  revalidatePath("/profile");
  return { success: true, message: "Body analysis ready.", status: "success" };
}

/** Extract metrics from a report photo; user confirms before anything saves. */
export async function extractReportAction(
  _prevState: BodyPhotosActionState,
  formData: FormData,
): Promise<BodyPhotosActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const photoId = String(formData.get("photo_id") ?? "").trim();
  if (!photoId) return { error: "Missing report id" };

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("body_photos")
    .select("id, storage_path, kind")
    .eq("id", photoId)
    .eq("user_id", user.id)
    .eq("kind", "analysis_report")
    .single();

  if (!photo) return { error: "Report not found" };

  const base64 = await downloadAsBase64(supabase, photo.storage_path);
  if (!base64) return { error: "Could not read the report image" };

  const metrics = await extractReportMetrics(base64, "image/jpeg");
  if ("error" in metrics) {
    return { error: metrics.error };
  }

  if (metrics.weight_kg === null && metrics.body_fat_pct === null) {
    return {
      error: "Couldn't read weight or body fat from this report — try a clearer photo",
    };
  }

  await supabase
    .from("body_photos")
    .update({ analysis: metrics, analyzed_at: new Date().toISOString() })
    .eq("id", photo.id)
    .eq("user_id", user.id);

  return {
    success: true,
    message: "Metrics extracted — review and save below.",
    status: "info",
    reportMetrics: metrics,
  };
}
