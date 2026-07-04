"use client";

/* eslint-disable @next/next/no-img-element -- signed, short-lived storage URLs;
   next/image can't optimize them and they expire anyway. */

import { useState, useActionState } from "react";
import { Camera, FileScan, Loader2, Sparkles, X } from "lucide-react";

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
  uploadBodyPhotoAction,
  type BodyPhotosActionState,
} from "../body-photos-actions";

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
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadBodyPhotoAction,
    initialState,
  );
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
      {/* Upload */}
      <form
        action={uploadAction}
        className="bg-card border-border space-y-2.5 rounded-xl border p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1 space-y-1.5">
            <Label htmlFor="photo">
              Add a progress photo or body-analysis report
            </Label>
            <Input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </div>
          <Button type="submit" variant="brand" disabled={uploading}>
            {uploading ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Camera aria-hidden />
            )}
            {uploading ? "Checking…" : "Upload"}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Up to 5 photos. Images are checked automatically for appropriate
          content before saving, and location metadata is stripped. Sports
          attire is fine; explicit photos are rejected.
        </p>
      </form>

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
