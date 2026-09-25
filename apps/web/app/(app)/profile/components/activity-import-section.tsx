"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useParseActivities } from "@/app/(app)/training/hooks/use-parse-activities";
import { activityLine, MAX_WATCH_FILES, type ActivitySummary } from "@/app/(app)/training/lib/watch-files";
import { useImportActivities } from "../hooks/use-profile";

/** Upload .fit/.gpx exports, review the runs, log them as completed workouts (FORMULAS §14). */
export function ActivityImportSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activities, setActivities] = useState<ActivitySummary[]>([]);
  const upload = useParseActivities();
  const importRuns = useImportActivities(() => setActivities([]));
  const busy = upload.isPending || importRuns.isPending;

  return (
    <div className='bg-card border-border space-y-3 rounded-xl border p-4'>
      <p className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
        <Watch className='text-brand-ink size-4' aria-hidden />
        Import watch activities
      </p>
      <p className='text-muted-foreground text-xs'>
        Upload .fit or .gpx exports from your watch (up to {MAX_WATCH_FILES} files) and log them as completed runs. Only
        the last 14 days count, and days you already logged are skipped.
      </p>
      <input
        ref={inputRef}
        type='file'
        accept='.fit,.gpx'
        multiple
        aria-label='Watch files'
        className='sr-only'
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) upload.parse(files, { onSuccess: (data) => setActivities(data?.activities ?? []) });
        }}
      />
      <Button type='button' variant='secondary' size='sm' disabled={busy} onClick={() => inputRef.current?.click()}>
        {upload.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <FileUp aria-hidden />}
        {upload.isPending ? "Parsing…" : "Choose files"}
      </Button>
      {activities.length > 0 && (
        <div className='space-y-2'>
          <ul className='divide-border divide-y'>
            {activities.map((activity, index) => (
              <li
                key={`${activity.date}-${index}`}
                className='flex items-baseline justify-between gap-3 py-1.5 text-sm'>
                <span className='text-foreground'>{activityLine(activity)}</span>
                <span className='text-muted-foreground text-xs uppercase'>{activity.source}</span>
              </li>
            ))}
          </ul>
          <Button
            type='button'
            variant='brand'
            size='sm'
            disabled={busy}
            onClick={() => importRuns.mutate({ body: { activities } })}>
            {importRuns.isPending ? <Loader2 className='animate-spin' aria-hidden /> : null}
            Log {activities.length} {activities.length === 1 ? "run" : "runs"}
          </Button>
        </div>
      )}
    </div>
  );
}
