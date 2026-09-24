"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParseActivities } from "../hooks/use-parse-activities";
import { activityLine, MAX_WATCH_FILES, type ActivitySummary } from "../lib/watch-files";

const EXPORT_HELP = [
  "Garmin: connect.garmin.com → activity → gear icon → Export to GPX (or Export Original for .fit).",
  "Apple Watch: use an app like HealthFit or RunGap to export workouts as GPX.",
  "Strava: activity page → ⋯ menu → Export GPX.",
  "Suunto / COROS: their web apps offer GPX export per workout.",
];

interface WatchDataUploadProps {
  /** The runs the plan will use: the last successful parse. */
  activities: ActivitySummary[];
  onParsed: (activities: ActivitySummary[]) => void;
}

/** Optional watch-file step: parse up to 3 exports; the runs inform the plan's paces. */
export function WatchDataUpload({ activities, onParsed }: WatchDataUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const upload = useParseActivities();

  return (
    <div className='bg-card border-border space-y-3 rounded-xl border p-4'>
      <Label htmlFor='activities'>Optional: upload recent runs (.fit or .gpx, up to {MAX_WATCH_FILES} files)</Label>
      <div className='flex flex-wrap items-center gap-3'>
        <Input
          id='activities'
          type='file'
          accept='.fit,.gpx'
          multiple
          className='max-w-xs'
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        />
        <Button
          type='button'
          variant='outline'
          disabled={upload.isPending || files.length === 0}
          onClick={() => upload.parse(files, { onSuccess: (data) => onParsed(data?.activities ?? []) })}>
          {upload.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <FileUp aria-hidden />}
          Parse files
        </Button>
      </div>
      {activities.length > 0 && (
        <ul className='text-muted-foreground space-y-1 text-sm'>
          {activities.map((activity, index) => (
            <li key={`${activity.date}-${index}`}>{activityLine(activity)}</li>
          ))}
        </ul>
      )}
      <details className='text-muted-foreground text-xs'>
        <summary className='text-foreground cursor-pointer font-medium'>How do I export files from my watch?</summary>
        <ul className='mt-2 list-disc space-y-1 pl-5'>
          {EXPORT_HELP.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
