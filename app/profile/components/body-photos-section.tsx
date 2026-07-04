"use client";

/* eslint-disable @next/next/no-img-element -- signed, short-lived storage URLs;
   next/image can't optimize them and they expire anyway. */

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Camera, FileScan, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BodyAnalysis } from "@/lib/ai/gemini";
import { addMeasurementAction } from "../actions";
import {
  analyzePhotosAction,
  deleteBodyPhotoAction,
  extractReportAction,
  uploadBodyPhotosAction,
  type BodyPhotosActionState,
} from "../body-photos-actions";

const MAX_BATCH = 5;
const MAX_ORIGINAL_BYTES = 3 * 1024 * 1024;
const TARGET_BYTES = 1024 * 1024;
const MAX_EDGE = 1600;
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

type PendingFile = { file: File; url: string };

/**
 * Client-side compression: downscale to ≤1600px and step JPEG quality down
 * until the file fits ~1MB. Canvas re-encoding also drops EXIF metadata.
 */
async function compressImage(file: File): Promise<File> {
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

const initialState: BodyPhotosActionState = {};

export type BodyPhotoItem = {
  id: string;
  kind: "body_photo" | "analysis_report";
  url: string | null;
  created_at: string;
};

interface BodyPhotosSectionProps {
  photos: BodyPhotoItem[];
  consented: boolean;
  analysis: BodyAnalysis | null;
}

export function BodyPhotosSection({
  photos,
  consented,
  analysis,
}: BodyPhotosSectionProps) {
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadBodyPhotosAction,
    initialState,
  );
  const [isSubmitting, startUpload] = useTransition();
  const uploading = uploadPending || isSubmitting;

  // Client-side selection: preview + remove BEFORE anything hits the server.
  const [pending, setPending] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preparing, setPreparing] = useState(false);

  const addFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    const files = Array.from(list);
    setPreparing(true);
    try {
      const prepared: PendingFile[] = [];
      for (const file of files) {
        if (pending.length + prepared.length >= MAX_BATCH) {
          toast.info(`Only ${MAX_BATCH} images per upload — extra files skipped`);
          break;
        }
        if (!ACCEPTED.has(file.type)) {
          toast.error(`${file.name}: use a JPEG, PNG, or WebP image`);
          continue;
        }
        if (file.size > MAX_ORIGINAL_BYTES) {
          toast.error(
            `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB — images must be 3MB or smaller`,
          );
          continue;
        }
        try {
          const compressed = await compressImage(file);
          prepared.push({
            file: compressed,
            url: URL.createObjectURL(compressed),
          });
        } catch (error) {
          console.error("Compression failed:", error);
          toast.error(`${file.name}: could not read this image`);
        }
      }
      if (prepared.length > 0) {
        setPending((current) => [...current, ...prepared].slice(0, MAX_BATCH));
      }
    } finally {
      setPreparing(false);
    }
  };

  const removePending = (url: string) => {
    setPending((current) => {
      const target = current.find((item) => item.url === url);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((item) => item.url !== url);
    });
  };

  const submitPending = () => {
    if (pending.length === 0 || uploading) return;
    // Belt & braces: never let the batch trip the server's 8MB action limit
    // (would surface as a raw framework error instead of a toast).
    const totalBytes = pending.reduce((sum, item) => sum + item.file.size, 0);
    if (totalBytes > 7 * 1024 * 1024) {
      toast.error("Selection is too large — remove a photo and try again");
      return;
    }
    const formData = new FormData();
    pending.forEach((item) => formData.append("photos", item.file));
    startUpload(() => uploadAction(formData));
  };

  // Clear the selection once an upload round-trip succeeds.
  const lastUploadRef = useRef<BodyPhotosActionState>(initialState);
  useEffect(() => {
    if (uploadState !== lastUploadRef.current && uploadState.success) {
      setPending((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.url));
        return [];
      });
    }
    lastUploadRef.current = uploadState;
  }, [uploadState]);
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteBodyPhotoAction,
    initialState,
  );
  const [analyzeState, analyzeAction, analyzing] = useActionState(
    analyzePhotosAction,
    initialState,
  );
  const [extractState, extractAction, extracting] = useActionState(
    extractReportAction,
    initialState,
  );
  const [saveState, saveAction, saving] = useActionState(
    addMeasurementAction,
    initialState,
  );
  useActionToast(uploadState);
  useActionToast(deleteState);
  useActionToast(analyzeState);
  useActionToast(extractState);
  useActionToast(saveState);

  const [confirmDelete, setConfirmDelete] = useState<BodyPhotoItem | null>(null);

  const bodyPhotos = photos.filter((photo) => photo.kind === "body_photo");
  const reports = photos.filter((photo) => photo.kind === "analysis_report");
  const metrics = extractState.reportMetrics;

  return (
    <div className="space-y-2.5">
      {/* Upload: pick several, preview, remove, then send */}
      <div className="bg-card border-border space-y-3 rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor="photos">
            Add progress photos or a body-analysis report
          </Label>
          <span className="text-muted-foreground text-xs">
            {pending.length} of {MAX_BATCH} selected
          </span>
        </div>

        <input
          ref={fileInputRef}
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(event) => addFiles(event.target.files)}
        />

        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {pending.map((item) => (
            <div
              key={item.url}
              className="border-border relative aspect-3/4 overflow-hidden rounded-xl border"
            >
              <img
                src={item.url}
                alt={`Selected: ${item.file.name}`}
                className="size-full object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${item.file.name}`}
                onClick={() => removePending(item.url)}
                disabled={uploading}
                className="bg-background/80 text-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full backdrop-blur-sm"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {pending.length < MAX_BATCH && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || preparing}
              className="border-border text-muted-foreground hover:border-brand/40 hover:text-foreground flex aspect-3/4 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition-colors disabled:opacity-60"
            >
              {preparing ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="size-5" aria-hidden />
              )}
              {preparing ? "Compressing…" : "Add images"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground max-w-sm text-xs">
            Up to 5 photos, 3MB each — they&apos;re compressed on your device
            before upload. Images are checked automatically for appropriate
            content before saving, and location metadata is stripped. Sports
            attire is fine; explicit photos are rejected.
          </p>
          <Button
            type="button"
            variant="brand"
            disabled={uploading || pending.length === 0}
            onClick={submitPending}
          >
            {uploading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Camera aria-hidden />
            )}
            {uploading
              ? "Checking…"
              : `Upload ${pending.length > 0 ? pending.length : ""}`.trim()}
          </Button>
        </div>
      </div>

      {/* Photo grid */}
      {bodyPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {bodyPhotos.map((photo) => (
            <div
              key={photo.id}
              className="border-border group relative aspect-3/4 overflow-hidden rounded-xl border"
            >
              {photo.url ? (
                <img
                  src={photo.url}
                  alt="Body progress photo"
                  className="size-full object-cover"
                />
              ) : (
                <div className="bg-secondary size-full" />
              )}
              <button
                type="button"
                aria-label="Delete photo"
                onClick={() => setConfirmDelete(photo)}
                className="bg-background/80 text-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full backdrop-blur-sm"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analyze (consent-gated) */}
      {bodyPhotos.length > 0 && (
        <form
          action={analyzeAction}
          className="bg-card border-border space-y-3 rounded-xl border p-4"
        >
          <label className="flex items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              name="consent"
              defaultChecked={consented}
              className="accent-brand mt-0.5 size-4"
            />
            <span className="text-muted-foreground">
              I consent to AI analysis of my photos to personalize my training
              program and diet.{" "}
              <span className="text-foreground font-medium">
                Not medical advice.
              </span>
            </span>
          </label>
          <Button type="submit" variant="brand" disabled={analyzing}>
            {analyzing ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Sparkles aria-hidden />
            )}
            {analyzing ? "Analyzing…" : "Analyze my photos"}
          </Button>
        </form>
      )}

      {/* Analysis result */}
      {analysis && (
        <div className="bg-card border-border space-y-2 rounded-xl border p-4">
          <p className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="text-brand size-4" aria-hidden />
            Body analysis
          </p>
          <p className="text-muted-foreground text-sm">{analysis.build_notes}</p>
          <p className="text-muted-foreground text-sm">{analysis.posture_notes}</p>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            {analysis.training_considerations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            AI observations, not medical advice. Used to personalize your
            program and diet.
          </p>
        </div>
      )}

      {/* Reports */}
      {reports.length > 0 && (
        <div className="bg-card border-border divide-border divide-y rounded-xl border px-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <p className="text-foreground inline-flex min-w-0 items-center gap-2 text-sm font-medium">
                <FileScan className="text-brand size-4 shrink-0" aria-hidden />
                Analysis report ·{" "}
                {new Date(report.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <form action={extractAction}>
                  <input type="hidden" name="photo_id" value={report.id} />
                  <Button type="submit" size="sm" variant="outline" disabled={extracting}>
                    {extracting ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : null}
                    Extract metrics
                  </Button>
                </form>
                <button
                  type="button"
                  aria-label="Delete report"
                  onClick={() => setConfirmDelete(report)}
                  className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-6 place-items-center rounded-md transition-colors"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Extracted metrics → confirm as measurement */}
      {metrics && (
        <form
          action={saveAction}
          className="bg-brand-tint border-brand/30 flex flex-wrap items-end gap-3 rounded-xl border p-4"
        >
          <div className="min-w-24 flex-1 space-y-1.5">
            <Label htmlFor="report_weight">Weight (kg)</Label>
            <Input
              id="report_weight"
              name="weight_kg"
              type="number"
              step="0.1"
              min={30}
              max={300}
              defaultValue={metrics.weight_kg ?? ""}
            />
          </div>
          <div className="min-w-24 flex-1 space-y-1.5">
            <Label htmlFor="report_bf">Body fat (%)</Label>
            <Input
              id="report_bf"
              name="body_fat_pct"
              type="number"
              step="0.1"
              min={3}
              max={60}
              defaultValue={metrics.body_fat_pct ?? ""}
            />
          </div>
          <Button type="submit" variant="brand" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save as measurement
          </Button>
          {metrics.notes ? (
            <p className="text-muted-foreground w-full text-xs">{metrics.notes}</p>
          ) : null}
        </form>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete this photo?"
        description="It is removed from storage permanently."
        confirmLabel="Delete"
        pending={deleting}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          const formData = new FormData();
          formData.set("photo_id", confirmDelete.id);
          deleteAction(formData);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
