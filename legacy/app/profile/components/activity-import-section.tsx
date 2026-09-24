"use client";

import { useActionState, useRef } from "react";
import { FileUp, Loader2, Watch } from "lucide-react";

import { useActionToast } from "@/components/hooks/use-action-toast";
import { Button } from "@/components/ui/button";
import {
  parseActivitiesAction,
  type TrainingActionState,
} from "@/app/training/actions";
import {
  importActivitiesAction,
  type ProfileActionState,
} from "../actions";

const initialParseState: TrainingActionState = {};
const initialImportState: ProfileActionState = {};

/**
 * Occasional watch-data import: upload .fit/.gpx exports, review the parsed
 * runs, log them as completed workouts (rules in FORMULAS.md §14). Reuses the
 * training module's parser action — nothing is persisted until "Log".
 */
export function ActivityImportSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parseState, parseAction, parsing] = useActionState(
    parseActivitiesAction,
    initialParseState,
  );
  const [importState, importAction, importing] = useActionState(
    importActivitiesAction,
    initialImportState,
  );
  useActionToast(parseState);
  useActionToast(importState);

  const activities = importState.success ? [] : (parseState.activities ?? []);

  return (
    <div className="bg-card border-border space-y-3 rounded-xl border p-4">
      <p className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
        <Watch className="text-brand-ink size-4" aria-hidden />
        Import watch activities
      </p>
      <p className="text-muted-foreground text-xs">
        Upload .fit or .gpx exports from your watch (up to 3 files) and log
        them as completed runs. Only the last 14 days count, and days you
        already logged are skipped.
      </p>

      <form action={parseAction} className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          name="activities"
          accept=".fit,.gpx"
          multiple
          className="sr-only"
          onChange={(event) => event.target.form?.requestSubmit()}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={parsing || importing}
          onClick={() => fileInputRef.current?.click()}
        >
          {parsing ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <FileUp aria-hidden />
          )}
          {parsing ? "Parsing…" : "Choose files"}
        </Button>
      </form>

      {activities.length > 0 && (
        <form action={importAction} className="space-y-2">
          <input
            type="hidden"
            name="activities_json"
            value={JSON.stringify(activities)}
          />
          <ul className="divide-border divide-y">
            {activities.map((activity, index) => (
              <li
                key={index}
                className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
              >
                <span className="text-foreground">
                  {activity.date} · {activity.distance_km} km ·{" "}
                  {activity.duration_min} min
                </span>
                <span className="text-muted-foreground text-xs">
                  {activity.avg_hr ? `${activity.avg_hr} bpm · ` : ""}
                  {activity.source.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
          <Button type="submit" variant="brand" size="sm" disabled={importing}>
            {importing ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Log {activities.length} {activities.length === 1 ? "run" : "runs"}
          </Button>
        </form>
      )}
    </div>
  );
}
