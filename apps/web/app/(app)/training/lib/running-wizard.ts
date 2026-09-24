import {
  BASE_WEEKS_DEFAULT,
  raceDistanceKm,
  RACE_TARGETS,
  suggestGoalForDistance,
  type RaceTarget,
} from "@/lib/running";
import type { components } from "@/lib/api/schema";

export type RunningBody = components["schemas"]["RunningPlanInputBody"];
export type PbKey = "pb_5k" | "pb_10k" | "pb_half" | "pb_full";

export interface RunningDraft {
  mode: "base" | "race";
  raceTarget: RaceTarget;
  customKm: string;
  baseWeeks: number;
  experienceLevel: string;
  raceDate: string;
  goalTime: string;
  pbs: Record<PbKey, string>;
  weeklyKm: string;
  longestRunKm: string;
  daysPerWeek: number;
  injuries: string;
}

export const INITIAL_RUNNING_DRAFT: RunningDraft = {
  mode: "base",
  raceTarget: "full",
  customKm: "",
  baseWeeks: BASE_WEEKS_DEFAULT,
  experienceLevel: "recreational",
  raceDate: "",
  goalTime: "",
  pbs: { pb_5k: "", pb_10k: "", pb_half: "", pb_full: "" },
  weeklyKm: "",
  longestRunKm: "",
  daysPerWeek: 4,
  injuries: "",
};

type Field = Exclude<keyof RunningDraft, "pbs">;

export type RunningAction =
  | { [K in Field]: { type: "set"; field: K; value: RunningDraft[K] } }[Field]
  | { type: "set_pb"; key: PbKey; value: string };

export function runningDraftReducer(draft: RunningDraft, action: RunningAction): RunningDraft {
  if (action.type === "set_pb") return { ...draft, pbs: { ...draft.pbs, [action.key]: action.value } };
  return { ...draft, [action.field]: action.value };
}

export const EXPERIENCE_LEVELS = [
  ["new", "New to running", "Starting from zero or walk/run"],
  ["recreational", "Recreational", "I run casually, no structured training"],
  ["regular", "Regular racer", "I train consistently and have raced"],
  ["competitive", "Competitive", "High volume, structured training"],
] as const;

export const WIZARD_STEPS = ["About you", "Running background", "Your goal", "Review"] as const;

export function needsCustomKm(target: RaceTarget): boolean {
  return target === "ultra" || target === "other";
}

/** The race distance in km, or null while it is unknown. */
export function targetKm(draft: RunningDraft): number | null {
  return raceDistanceKm(draft.raceTarget, needsCustomKm(draft.raceTarget) ? Number(draft.customKm) : null);
}

export function hasAnyPb(draft: RunningDraft): boolean {
  return Object.values(draft.pbs).some((value) => value.trim() !== "");
}

/** Goal time predicted from the PBs (Riegel), or null. */
export function suggestedGoal(draft: RunningDraft): string | null {
  const km = targetKm(draft);
  return km ? suggestGoalForDistance(draft.pbs, km) : null;
}

export function targetLabel(target: RaceTarget): string {
  return RACE_TARGETS.find((entry) => entry.value === target)?.label ?? "race";
}

/** Noun for the review step: "running" for base plans, else the race. */
export function planLabel(draft: RunningDraft): string {
  return draft.mode === "base" ? "running" : targetLabel(draft.raceTarget).toLowerCase();
}

function numberOrUndefined(value: string): number | undefined {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

/** The API request for a draft; race fields only in race mode. */
export function runningBody(draft: RunningDraft, targetStudentId?: string): RunningBody {
  const common = {
    mode: draft.mode,
    experienceLevel: draft.experienceLevel,
    daysPerWeek: draft.daysPerWeek,
    pb5k: draft.pbs.pb_5k,
    pb10k: draft.pbs.pb_10k,
    pbHalf: draft.pbs.pb_half,
    pbFull: draft.pbs.pb_full,
    weeklyKm: numberOrUndefined(draft.weeklyKm),
    longestRunKm: numberOrUndefined(draft.longestRunKm),
    injuries: draft.injuries,
    targetStudentId,
  };
  if (draft.mode === "base") return { ...common, baseWeeks: draft.baseWeeks };
  return {
    ...common,
    raceTarget: draft.raceTarget,
    customDistanceKm: needsCustomKm(draft.raceTarget) ? numberOrUndefined(draft.customKm) : undefined,
    raceDate: draft.raceDate,
    goalTime: draft.goalTime,
  };
}
