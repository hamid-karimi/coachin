/** "My week" add-commitment flow: sheet steps, form state, and derivations. */

export type CommitmentType = "fixed" | "target";
export type SheetStep = "sport" | "details";

export interface SheetState {
  open: boolean;
  step: SheetStep;
  /** Picked sport id; null until one is chosen. */
  sportId: number | null;
  commitmentType: CommitmentType;
}

export type SheetAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "pick_sport"; sportId: number | null }
  | { type: "back" }
  | { type: "set_commitment_type"; value: CommitmentType };

export const INITIAL_SHEET: SheetState = { open: false, step: "sport", sportId: null, commitmentType: "fixed" };

type Handlers<S, A extends { type: string }> = {
  [K in A["type"]]: (state: S, action: Extract<A, { type: K }>) => S;
};

const SHEET_HANDLERS: Handlers<SheetState, SheetAction> = {
  // Fresh flow every time — no stale picks from the last add.
  open: () => ({ ...INITIAL_SHEET, open: true }),
  close: (state) => ({ ...state, open: false }),
  // Tapping the active chip clears it and stays on step 1.
  pick_sport: (state, { sportId }) =>
    sportId === null ? { ...state, sportId: null } : { ...state, sportId, step: "details" },
  back: (state) => ({ ...state, step: "sport" }),
  set_commitment_type: (state, { value }) => ({ ...state, commitmentType: value }),
};

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  return (SHEET_HANDLERS[action.type] as (s: SheetState, a: SheetAction) => SheetState)(state, action);
}

export interface FixedSessionState {
  /** 0=Sun … 6=Sat; null until picked. */
  dayOfWeek: number | null;
  time: string;
  endsOn: string;
  dayError: string | null;
  sportError: string | null;
}

export type FixedSessionAction =
  | { type: "toggle_day"; day: number }
  | { type: "set_time"; value: string }
  | { type: "set_ends_on"; value: string }
  | { type: "reject"; dayError: string | null; sportError: string | null }
  | { type: "reset" };

export const INITIAL_FIXED_SESSION: FixedSessionState = {
  dayOfWeek: null,
  time: "",
  endsOn: "",
  dayError: null,
  sportError: null,
};

const FIXED_SESSION_HANDLERS: Handlers<FixedSessionState, FixedSessionAction> = {
  toggle_day: (state, { day }) => {
    const dayOfWeek = state.dayOfWeek === day ? null : day;
    // Picking a day answers the "pick a day" error; deselecting keeps it.
    return { ...state, dayOfWeek, dayError: dayOfWeek === null ? state.dayError : null };
  },
  set_time: (state, { value }) => ({ ...state, time: value }),
  set_ends_on: (state, { value }) => ({ ...state, endsOn: value }),
  reject: (state, { dayError, sportError }) => ({ ...state, dayError, sportError }),
  reset: () => INITIAL_FIXED_SESSION,
};

export function fixedSessionReducer(state: FixedSessionState, action: FixedSessionAction): FixedSessionState {
  return (FIXED_SESSION_HANDLERS[action.type] as (s: FixedSessionState, a: FixedSessionAction) => FixedSessionState)(
    state,
    action,
  );
}

/** Pointing errors for an incomplete fixed session, or null when it can be sent. */
export function fixedSessionErrors(
  sportId: number | null,
  dayOfWeek: number | null,
): { sportError: string | null; dayError: string | null } | null {
  const sportError = sportId === null ? "Pick a sport first" : null;
  const dayError = dayOfWeek === null ? "Pick at least one day" : null;
  return sportError || dayError ? { sportError, dayError } : null;
}

// Mirrors the API's 1..14 bounds; most people target 1–7, so start low.
export const MIN_SESSIONS = 1;
export const MAX_SESSIONS = 14;
export const DEFAULT_SESSIONS = 2;

export function clampSessions(n: number): number {
  return Math.min(MAX_SESSIONS, Math.max(MIN_SESSIONS, n));
}

/** Distinct weekdays (0-6) that have at least one fixed session. */
export function plannedDays(schedules: ReadonlyArray<{ dayOfWeek: number }>): number[] {
  return [...new Set(schedules.map((s) => s.dayOfWeek))];
}

/** "3 days planned" copy. */
export function daysPlannedLabel(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"} planned`;
}
