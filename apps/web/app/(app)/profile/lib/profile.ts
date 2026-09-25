import type { components } from "@/lib/api/schema";

export type ActiveGoal = components["schemas"]["ActiveGoalBody"];
export type Goal = components["schemas"]["GoalBody"];
export type GoalType = Goal["goalType"];
export type Measurement = components["schemas"]["MeasurementBody"];
export type BodyProfileInput = components["schemas"]["UpdateBodyInputBody"];
export type MeasurementInput = components["schemas"]["MeasurementInputBody"];
export type GoalInput = components["schemas"]["CreateGoalInputBody"];

export const PROFILE_TABS = ["overview", "progress", "body", "settings"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];

/** A ?tab= value; anything unknown lands on overview. */
export function resolveProfileTab(raw: string | string[] | undefined): ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(typeof raw === "string" ? raw : "")
    ? (raw as ProfileTab)
    : "overview";
}

export function profileTabHref(tab: ProfileTab): string {
  return tab === "overview" ? "/profile" : `/profile?tab=${tab}`;
}

/** Goal types for display (mirrors the API's domain/goals.TypeMeta). */
export const GOAL_META: Record<
  GoalType,
  { label: string; unit: string; source: "measurement" | "nutrition" | "activity" }
> = {
  weight: { label: "Weight", unit: "kg", source: "measurement" },
  body_fat_pct: { label: "Body fat", unit: "%", source: "measurement" },
  calorie_intake: { label: "Daily calorie intake", unit: "kcal", source: "nutrition" },
  calories_burned: { label: "Daily calories burned", unit: "kcal", source: "nutrition" },
  weekly_run_km: { label: "Weekly running", unit: "km", source: "activity" },
  monthly_run_km: { label: "Monthly running", unit: "km", source: "activity" },
};

const GOAL_TYPES = Object.keys(GOAL_META) as GoalType[];

/** Why an untracked goal has no progress yet. */
const SOURCE_HINTS: Record<string, string> = {
  measurement: "Log a measurement to start tracking.",
  nutrition: "Tracking arrives with calorie logging.",
  activity: "Tracking arrives once runs carry distance.",
};

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const DAY_DATE: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" };

function localDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00`);
}

/** "joined September 2026" */
export function joinedLabel(iso: string): string {
  return `joined ${new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

/** "Fri, Sep 25" for a timestamp. */
export function xpDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", DAY_DATE);
}

/** "Sun, Sep 20" for a YYYY-MM-DD date. */
export function measurementDateLabel(ymd: string): string {
  return localDate(ymd).toLocaleDateString("en-US", DAY_DATE);
}

/** "72.5 kg · 18% body fat" */
export function measurementLine(m: Pick<Measurement, "weightKg" | "bodyFatPct">): string {
  return [m.weightKg != null ? `${m.weightKg} kg` : null, m.bodyFatPct != null ? `${m.bodyFatPct}% body fat` : null]
    .filter(Boolean)
    .join(" · ");
}

/** "Weight 70kg" */
export function goalLabel(goal: Pick<Goal, "goalType" | "target">): string {
  const meta = GOAL_META[goal.goalType];
  return `${meta.label} ${goal.target}${meta.unit}`;
}

/** Under an active goal: "75kg now · 50% there · by Dec 31", or the tracking hint. */
export function goalStatusLine(goal: ActiveGoal): string {
  const meta = GOAL_META[goal.goalType];
  if (!goal.progress) return SOURCE_HINTS[meta.source];
  const by = goal.targetDate ? ` · by ${localDate(goal.targetDate).toLocaleDateString("en-US", SHORT_DATE)}` : "";
  return `${goal.current}${meta.unit} now · ${goal.progress.pct}% there${by}`;
}

/** Types without an active goal (one active per type). */
export function availableGoalTypes(active: Pick<Goal, "goalType">[]): GoalType[] {
  const taken = new Set(active.map((goal) => goal.goalType));
  return GOAL_TYPES.filter((type) => !taken.has(type));
}

/** The tracked goal closest to completion (the dashboard strip). */
export function featuredGoal(active: ActiveGoal[]): ActiveGoal | null {
  return active
    .filter((goal) => goal.progress)
    .reduce<ActiveGoal | null>((best, goal) => (!best || goal.progress!.pct > best.progress!.pct ? goal : best), null);
}

/** "" → absent, anything else → a number (NaN reaches the API as a 422). */
function optionalNumber(value: FormDataEntryValue | null): number | undefined {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw ? Number(raw) : undefined;
}

function text(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export function bodyProfileInput(form: FormData): BodyProfileInput {
  return {
    birthDate: text(form.get("birthDate")),
    sex: text(form.get("sex")),
    heightCm: optionalNumber(form.get("heightCm")),
    trainingHistory: text(form.get("trainingHistory")),
    country: text(form.get("country")),
  };
}

export function measurementInput(form: FormData): MeasurementInput {
  return { weightKg: optionalNumber(form.get("weightKg")), bodyFatPct: optionalNumber(form.get("bodyFatPct")) };
}

export function goalInput(form: FormData): GoalInput {
  return {
    goalType: text(form.get("goalType")),
    target: optionalNumber(form.get("target")) ?? 0,
    targetDate: text(form.get("targetDate")),
  };
}
