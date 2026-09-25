"use client";

import { useReducer, useState } from "react";
import { Loader2, NotebookPen, Save } from "lucide-react";
import { useConfettiBurst } from "@/components/hooks/use-confetti-burst";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EMPTY_SESSION_LOG, sessionLogBody, sessionLogReducer, type LoggableSport } from "@/lib/session-log";
import { sessionShareCard } from "@/lib/share-card";
import { buildEditableExercises, strengthSetsReducer, toLoggedExercises } from "@/lib/strength-sets";
import { useSessionLog } from "../hooks/use-session-log";
import { RpePicker } from "./rpe-picker";
import { RunLogFields } from "./run-log-fields";
import { SessionLogResult } from "./session-log-result";
import { StrengthSetsEditor } from "./strength-sets-editor";

interface SessionLogSheetProps {
  itemId: string;
  sport: LoggableSport;
  itemTitle: string;
  /** The full prescription — prefills the strength editor. */
  itemDescription?: string | null;
}

/** Optional "How did it go?" log under a completed run or strength item. */
export function SessionLogSheet({ itemId, sport, itemTitle, itemDescription }: SessionLogSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, dispatchDraft] = useReducer(sessionLogReducer, EMPTY_SESSION_LOG);
  const [exercises, dispatchSets] = useReducer(
    strengthSetsReducer,
    itemDescription || itemTitle,
    buildEditableExercises,
  );
  const log = useSessionLog();
  useConfettiBurst((log.data?.totalVolumeKg ?? 0) > 0);

  if (log.data) {
    const share = sessionShareCard({
      title: itemTitle,
      totalVolumeKg: log.data.totalVolumeKg,
      exercises: toLoggedExercises(exercises),
    });
    return <SessionLogResult result={log.data} share={share} />;
  }

  if (!open) {
    return (
      <div className='pl-11'>
        <Button type='button' variant='ghost' size='sm' onClick={() => setOpen(true)}>
          <NotebookPen aria-hidden />
          Log details
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        log.mutate({
          params: { path: { id: itemId } },
          body: sessionLogBody(sport, draft, exercises),
        });
      }}
      className='bg-card border-border ml-11 space-y-3 rounded-xl border p-4'>
      <p className='text-foreground text-sm font-semibold'>
        How did it go? <span className='text-muted-foreground font-normal'>— {itemTitle}</span>
      </p>
      <RpePicker value={draft.rpe} onToggle={(value) => dispatchDraft({ type: "toggle_rpe", value })} />
      {sport === "run" ? (
        <RunLogFields
          itemId={itemId}
          draft={draft}
          onChange={(field, value) => dispatchDraft({ type: "set", field, value })}
        />
      ) : (
        <StrengthSetsEditor exercises={exercises} dispatch={dispatchSets} />
      )}
      <div className='space-y-1.5'>
        <Label htmlFor={`note-${itemId}`}>Note (optional)</Label>
        <Textarea
          id={`note-${itemId}`}
          rows={2}
          maxLength={500}
          placeholder='How did it feel? Any pain?'
          value={draft.note}
          onChange={(e) => dispatchDraft({ type: "set", field: "note", value: e.target.value })}
        />
      </div>
      <div className='flex items-center justify-end gap-2'>
        <Button key='skip' type='button' variant='ghost' size='sm' onClick={() => setOpen(false)}>
          Skip
        </Button>
        <Button key='save' type='submit' variant='brand' size='sm' disabled={log.isPending}>
          {log.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Save aria-hidden />}
          Save log
        </Button>
      </div>
    </form>
  );
}
