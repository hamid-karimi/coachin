import type { components } from "@/lib/api/schema";

export type Trainee = components["schemas"]["TraineeBody"];
export type WeekDot = components["schemas"]["WeekDotBody"];
export type InviteCode = components["schemas"]["InviteCodeBody"];

/** A plan under this adherence this week is flagged "Off-track". */
export const OFF_TRACK_PCT = 50;

/** "Running · Level 3 · 120 XP this week" */
export function traineeSubtitle(t: Pick<Trainee, "sport" | "level" | "weeklyXp">): string {
  return `${t.sport?.name || "General coaching"} · Level ${t.level} · ${t.weeklyXp.toLocaleString("en-US")} XP this week`;
}

/** "2 of 3 this week", or the no-routine hint. */
export function adherenceLine(t: Pick<Trainee, "doneCount" | "scheduledCount">): string {
  return t.scheduledCount === 0 ? "No plan assigned yet" : `${t.doneCount} of ${t.scheduledCount} this week`;
}

const PLAN_KIND_LABEL: Record<string, string> = { hypertrophy: "Strength", race: "Running" };

/** "Off-track · Strength 40%" chips for plans under 50% this week. */
export function offTrackChips(t: Pick<Trainee, "plans">): { id: string; label: string }[] {
  return t.plans
    .filter((plan) => plan.adherencePct < OFF_TRACK_PCT)
    .map((plan) => ({
      id: plan.planId,
      label: `Off-track · ${PLAN_KIND_LABEL[plan.kind] ?? "Running"} ${Math.round(plan.adherencePct)}%`,
    }));
}

/** Trainees ranked by XP this week (ties keep roster order), one row each. */
export function weeklyRanking(trainees: Trainee[]): Trainee[] {
  const seen = new Set<string>();
  return trainees
    .filter((t) => !seen.has(t.id) && seen.add(t.id))
    .map((t, index) => ({ t, index }))
    .sort((a, b) => b.t.weeklyXp - a.t.weeklyXp || a.index - b.index)
    .map(({ t }) => t);
}

/** "3 active trainees" / the empty-roster hint. */
export function rosterLine(count: number): string {
  if (count === 0) return "No trainees yet — share an invite code to connect.";
  return `${count} active ${count === 1 ? "trainee" : "trainees"}`;
}

/** Dashboard card line: "2 trainees · 1 trained this week". */
export function coachingSummaryLine(traineeCount: number, trainedThisWeek: number): string {
  return `${traineeCount} ${traineeCount === 1 ? "trainee" : "trainees"} · ${trainedThisWeek} trained this week`;
}

export type TraineeNutrition = components["schemas"]["TraineeNutritionBody"];
export type TraineeDay = components["schemas"]["TraineeDayBody"];
export type TraineeSupplement = components["schemas"]["TraineeSupplementBody"];

/** "Meal plan targets: 2,100 kcal · 140g protein" (null without targets). */
export function targetsLine(targets: TraineeNutrition["targets"]): string | null {
  if (!targets || (!targets.kcal && !targets.proteinG)) return null;
  const parts = [
    targets.kcal ? `${Math.round(targets.kcal).toLocaleString("en-US")} kcal` : null,
    targets.proteinG ? `${Math.round(targets.proteinG)}g protein` : null,
  ].filter(Boolean);
  return `Meal plan targets: ${parts.join(" · ")}`;
}

/** A day's kcal badge ("1,820 kcal / 2,100") and whether it went over. */
export function dayKcal(day: Pick<TraineeDay, "totalKcal">, kcalTarget?: number): { text: string; over: boolean } {
  const total = Math.round(day.totalKcal).toLocaleString("en-US");
  if (!kcalTarget) return { text: `${total} kcal`, over: false };
  return {
    text: `${total} kcal / ${Math.round(kcalTarget).toLocaleString("en-US")}`,
    over: day.totalKcal > kcalTarget,
  };
}

/** "Fri, Sep 25" */
export function traineeDayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/** "5/7 due days", or none in the window. */
export function takenRateText(s: Pick<TraineeSupplement, "takenDueDays" | "totalDueDays">): string {
  return s.totalDueDays === 0 ? "No due days in the last week" : `${s.takenDueDays}/${s.totalDueDays} due days`;
}
