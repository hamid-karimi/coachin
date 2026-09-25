"use client";

import { useRef, useState } from "react";
import { Camera, FileScan, ImagePlus, Loader2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/design-system/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { components } from "@/lib/api/schema";
import { useDeletePhoto, useExtractReport, usePhotos, useUploadPhotos } from "../hooks/use-profile";
import { usePendingPhotos } from "../hooks/use-pending-photos";
import { MAX_BATCH, photoDayLabel, uploadLabel } from "../lib/photos";
import { BodyAnalysisPanel } from "./body-analysis-panel";
import { PhotoTile, TileRemoveButton } from "./photo-tile";
import { ReportMetricsForm } from "./report-metrics-form";

type ReportMetrics = components["schemas"]["ReportMetricsBody"];

/** The AI analysis set: pick up to 5 images (previewed), upload, then the body photos and reports kept. */
export function BodyPhotosSection() {
  const { bodyPhotos, reports } = usePhotos();
  const input = useRef<HTMLInputElement>(null);
  const picker = usePendingPhotos(MAX_BATCH);
  const upload = useUploadPhotos(picker.clear);
  const remove = useDeletePhoto();
  const [confirming, setConfirming] = useState<string | null>(null);
  const extract = useExtractReport();
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);

  return (
    <div className='space-y-2.5'>
      <div className='bg-card border-border space-y-3 rounded-xl border p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Label htmlFor='body-photos'>Add progress photos or a body-analysis report</Label>
          <span className='text-muted-foreground text-xs'>
            {picker.pending.length} of {MAX_BATCH} selected
          </span>
        </div>
        <input
          ref={input}
          id='body-photos'
          type='file'
          accept='image/jpeg,image/png,image/webp'
          multiple
          className='sr-only'
          onChange={(e) => {
            void picker.add(e.target.files);
            e.target.value = "";
          }}
        />
        <div className='grid grid-cols-3 gap-2.5 sm:grid-cols-5'>
          {picker.pending.map((item) => (
            <div key={item.url} className='border-border relative aspect-3/4 overflow-hidden rounded-xl border'>
              {/* A local preview (blob: URL). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={`Selected: ${item.file.name}`} className='size-full object-cover' />
              <TileRemoveButton
                label={`Remove ${item.file.name}`}
                onClick={() => picker.remove(item.url)}
                disabled={upload.isPending}
              />
            </div>
          ))}
          {picker.pending.length < MAX_BATCH && (
            <button
              type='button'
              onClick={() => input.current?.click()}
              disabled={upload.isPending || picker.preparing}
              className='border-border text-muted-foreground hover:border-brand/40 hover:text-foreground flex aspect-3/4 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs transition-colors disabled:opacity-60'>
              {picker.preparing ? (
                <Loader2 className='size-5 animate-spin' aria-hidden />
              ) : (
                <ImagePlus className='size-5' aria-hidden />
              )}
              {picker.preparing ? "Compressing…" : "Add images"}
            </button>
          )}
        </div>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-muted-foreground max-w-sm text-xs'>
            Up to 5 photos — they&apos;re compressed on your device before upload. Images are checked automatically for
            appropriate content before saving, and location metadata is stripped. Sports attire is fine; explicit photos
            are rejected.
          </p>
          <Button
            type='button'
            variant='brand'
            disabled={upload.isPending || picker.pending.length === 0}
            onClick={() =>
              upload.upload(
                picker.pending.map((item) => item.file),
                "body",
              )
            }>
            {upload.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Camera aria-hidden />}
            {upload.isPending ? "Checking…" : uploadLabel(picker.pending.length)}
          </Button>
        </div>
      </div>

      {bodyPhotos.length > 0 && (
        <div className='grid grid-cols-3 gap-2.5 sm:grid-cols-5'>
          {bodyPhotos.map((photo) => (
            <PhotoTile key={photo.id} id={photo.id} alt='Body progress photo'>
              <TileRemoveButton label='Delete photo' onClick={() => setConfirming(photo.id)} />
            </PhotoTile>
          ))}
        </div>
      )}

      <BodyAnalysisPanel />

      {reports.length > 0 && (
        <div className='bg-card border-border divide-border divide-y rounded-xl border px-4'>
          {reports.map((report) => (
            <div key={report.id} className='flex items-center justify-between gap-3 py-3'>
              <p className='text-foreground inline-flex min-w-0 items-center gap-2 text-sm font-medium'>
                <FileScan className='text-brand size-4 shrink-0' aria-hidden />
                Analysis report · {photoDayLabel(report.createdAt)}
              </p>
              <div className='flex shrink-0 items-center gap-2'>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={extract.isPending}
                  onClick={() =>
                    extract.mutate({ params: { path: { id: report.id } } }, { onSuccess: (data) => setMetrics(data) })
                  }>
                  {extract.isPending && extract.variables?.params.path.id === report.id ? (
                    <Loader2 className='animate-spin' aria-hidden />
                  ) : null}
                  Extract metrics
                </Button>
                <button
                  type='button'
                  aria-label='Delete report'
                  onClick={() => setConfirming(report.id)}
                  className='text-muted-foreground hover:bg-secondary hover:text-foreground grid size-6 place-items-center rounded-md transition-colors'>
                  <X className='size-3.5' aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {metrics && <ReportMetricsForm metrics={metrics} onSaved={() => setMetrics(null)} />}

      <ConfirmDialog
        open={confirming !== null}
        title='Delete this photo?'
        description='It is removed from storage permanently.'
        confirmLabel='Delete'
        pending={remove.isPending}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          if (!confirming) return;
          remove.mutate({ params: { path: { id: confirming } } }, { onSettled: () => setConfirming(null) });
        }}
      />
    </div>
  );
}
