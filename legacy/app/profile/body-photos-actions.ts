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
 * Batch upload pipeline: per file — validate → sharp re-encode (strips
 * EXIF/GPS, caps size) → Gemini moderation gate → storage + metadata row.
 * Rejected images are never written to storage; the rest of the batch
 * still proceeds (partial success is reported per file).
 */
export async function uploadBodyPhotosAction(
  _prevState: BodyPhotosActionState,
  formData: FormData,
): Promise<BodyPhotosActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const files = formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length === 0) {
    return { error: "Choose at least one image to upload" };
  }
  if (files.length > MAX_BODY_PHOTOS) {
    return { error: `Upload at most ${MAX_BODY_PHOTOS} images at a time` };
  }

  const supabase = await createClient();

  // Current usage, tracked across the batch so caps hold within it too.
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
  let photosUsed = photoCount ?? 0;
  let reportsUsed = reportCount ?? 0;

  let uploaded = 0;
  let uploadedReports = 0;
  const rejected: string[] = [];

  for (const file of files) {
    const label = file.name || "image";

    if (!ACCEPTED_TYPES.has(file.type)) {
      rejected.push(`${label}: use JPEG, PNG, or WebP`);
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      rejected.push(`${label}: must be 5MB or smaller`);
      continue;
    }
    if (photosUsed >= MAX_BODY_PHOTOS && reportsUsed >= MAX_REPORTS) {
      rejected.push(`${label}: photo and report limits reached`);
      continue;
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
      rejected.push(`${label}: could not read the image`);
      continue;
    }

    // Moderation gate (disclosed in the upload UI) — one AI call per file.
    const moderation = await moderateBodyImage(
      jpeg.toString("base64"),
      "image/jpeg",
    );
    if (!moderation.ok) {
      rejected.push(`${label}: ${moderation.reason}`);
      if ("unavailable" in moderation) break; // no point burning the batch
      continue;
    }

    const kind =
      moderation.category === "analysis_report"
        ? "analysis_report"
        : "body_photo";
    if (kind === "body_photo" && photosUsed >= MAX_BODY_PHOTOS) {
      rejected.push(`${label}: you already have ${MAX_BODY_PHOTOS} photos`);
      continue;
    }
    if (kind === "analysis_report" && reportsUsed >= MAX_REPORTS) {
      rejected.push(`${label}: you already have ${MAX_REPORTS} reports`);
      continue;
    }

    const storagePath = `${user.id}/${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, jpeg, { contentType: "image/jpeg" });
    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      rejected.push(`${label}: failed to store`);
      continue;
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
      rejected.push(`${label}: failed to save`);
      continue;
    }

    if (kind === "analysis_report") {
      reportsUsed += 1;
      uploadedReports += 1;
    } else {
      photosUsed += 1;
    }
    uploaded += 1;
  }

  revalidatePath("/profile");

  if (uploaded === 0) {
    return { error: rejected.join(" · ") || "Nothing was uploaded" };
  }

  const parts = [
    `${uploaded} ${uploaded === 1 ? "image" : "images"} uploaded`,
    uploadedReports > 0 ? "report metrics can be extracted below" : null,
    rejected.length > 0 ? `rejected — ${rejected.join(" · ")}` : null,
  ].filter(Boolean);

  return {
    success: true,
    message: `${parts.join("; ")}.`,
    status: rejected.length > 0 ? "info" : "success",
  };
}

const MAX_PROGRESS_PHOTOS = 24;

/**
 * Upload ONE progress-journal photo (kind 'progress'). Same pipeline as the
 * analysis set — sharp re-encode (strips EXIF/GPS) + moderation gate — but a
 * separate, larger cap (24) and never fed into AI analysis.
 */
export async function uploadProgressPhotoAction(
  _prevState: BodyPhotosActionState,
  formData: FormData,
): Promise<BodyPhotosActionState> {
  const user = await getUser();
  if (!user) {
    return { error: "You must be signed in" };
  }

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a photo" };
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return { error: "Use JPEG, PNG, or WebP" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Photo must be 5MB or smaller" };
  }

  const supabase = await createClient();
  const { count } = await supabase
    .from("body_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", "progress");
  if ((count ?? 0) >= MAX_PROGRESS_PHOTOS) {
    return {
      error: `You already have ${MAX_PROGRESS_PHOTOS} progress photos — delete an old one first`,
    };
  }

  let jpeg: Buffer;
  try {
    const original = Buffer.from(await file.arrayBuffer());
    jpeg = await sharp(original)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (error) {
    console.error("Progress photo re-encode failed:", error);
    return { error: "Could not read that image" };
  }

  const moderation = await moderateBodyImage(
    jpeg.toString("base64"),
    "image/jpeg",
  );
  if (!moderation.ok) {
    return { error: moderation.reason };
  }
  if (moderation.category === "analysis_report") {
    return {
      error:
        "That looks like a report — upload it in the analysis set instead",
    };
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, jpeg, { contentType: "image/jpeg" });
  if (uploadError) {
    console.error("Progress photo upload failed:", uploadError);
    return { error: "Failed to store the photo" };
  }

  const { error: insertError } = await supabase.from("body_photos").insert({
    user_id: user.id,
    storage_path: storagePath,
    kind: "progress",
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    console.error("progress photo insert failed:", insertError);
    return { error: "Failed to save the photo" };
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true, message: "Progress photo added.", status: "success" };
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

  // Row first, storage second: an orphaned storage object is invisible and
  // harmless, but a surviving row pointing at a deleted object is a broken
  // image that still counts against the photo cap.
  const { error } = await supabase
    .from("body_photos")
    .delete()
    .eq("id", photoId)
    .eq("user_id", user.id);

  if (error) {
    console.error("body_photos delete failed:", error);
    return { error: "Failed to delete the photo" };
  }

  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([photo.storage_path]);
  if (storageError) {
    console.error("Storage delete failed:", storageError);
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
