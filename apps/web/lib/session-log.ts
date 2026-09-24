import type { components } from "@/lib/api/schema";
import { toLoggedExercises, type EditableExercise } from "./strength-sets";

export type SessionLogBody = components["schemas"]["LogSessionInputBody"];
export type LoggableSport = SessionLogBody["sport"];

/** Only runs and strength sessions take a "how did it go" log. */
export function isLoggable(itemType: string): itemType is LoggableSport {
  return itemType === "run" || itemType === "strength";
}

export type RunField = "distanceKm" | "durationMin" | "avgHr";

/** The log sheet's non-strength inputs; numbers stay strings until submit. */
export type SessionLogDraft = { rpe: number | null; note: string } & Record<RunField, string>;

export type SessionLogAction =
  | { type: "toggle_rpe"; value: number }
  | { type: "set"; field: RunField | "note"; value: string };

export const EMPTY_SESSION_LOG: SessionLogDraft = {
  rpe: null,
  note: "",
  distanceKm: "",
  durationMin: "",
  avgHr: "",
};

const HANDLERS: {
  [T in SessionLogAction["type"]]: (d: SessionLogDraft, a: Extract<SessionLogAction, { type: T }>) => SessionLogDraft;
} = {
  toggle_rpe: (draft, { value }) => ({
    ...draft,
    rpe: draft.rpe === value ? null : value,
  }),
  set: (draft, { field, value }) => ({ ...draft, [field]: value }),
};

export function sessionLogReducer(draft: SessionLogDraft, action: SessionLogAction): SessionLogDraft {
  return HANDLERS[action.type](draft, action as never);
}

/** A positive finite number from an input, else undefined (the field is optional). */
function positive(value: string): number | undefined {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** The request body: every field optional beyond the sport. */
export function sessionLogBody(
  sport: LoggableSport,
  draft: SessionLogDraft,
  exercises: EditableExercise[],
): SessionLogBody {
  const note = draft.note.trim();
  const body: SessionLogBody = {
    sport,
    rpe: draft.rpe ?? undefined,
    note: note || undefined,
  };
  if (sport === "run") {
    return {
      ...body,
      distanceKm: positive(draft.distanceKm),
      durationMin: positive(draft.durationMin),
      avgHr: positive(draft.avgHr),
    };
  }
  const logged = toLoggedExercises(exercises);
  return logged.length > 0 ? { ...body, exercises: logged } : body;
}

/** Text tone of the AI coach's comment by flag. */
export const FEEDBACK_TONE: Record<string, string> = {
  ok: "text-muted-foreground",
  caution: "text-flame-ink",
  red: "text-destructive",
};
