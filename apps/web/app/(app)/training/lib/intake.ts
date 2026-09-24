import type { components } from "@/lib/api/schema";

export type IntakeContext = components["schemas"]["IntakeContextBody"];

function profileParts(ctx: IntakeContext): string[] {
  return [
    ctx.age ? `${ctx.age} years old` : null,
    ctx.sex || null,
    ctx.heightCm ? `${ctx.heightCm}cm` : null,
    ctx.weightKg ? `${ctx.weightKg}kg` : null,
  ].filter((part): part is string => part !== null);
}

/** "36 years old · female · 168cm · 61kg — Ran two marathons". */
export function profileSummary(ctx: IntakeContext): string {
  const parts = profileParts(ctx);
  if (parts.length === 0) return "No body profile yet — the plan will rely on your answers only.";
  return parts.join(" · ") + (ctx.trainingHistory ? ` — ${ctx.trainingHistory}` : "");
}

/** At least three of age, sex, height, weight are known. */
export function hasBodyProfile(ctx: IntakeContext): boolean {
  return profileParts(ctx).length >= 3;
}

export type PlanKindChoice = "race" | "hypertrophy";

export const PLAN_KIND_COPY: Record<PlanKindChoice, { title: string; description: string }> = {
  race: {
    title: "Running plan",
    description:
      "Just want to build a running habit, or training for a 5k, marathon, or ultra — answer a few questions and get a week-by-week program: running, strength, mobility, recovery, and fueling notes.",
  },
  hypertrophy: {
    title: "Muscle building plan",
    description:
      "A progressive-overload program built around your equipment, experience, and body profile — with form videos and protein guidance.",
  },
};

/** "kind" search param → wizard, or null for the chooser. */
export function planKindFrom(kind: string | string[] | undefined): PlanKindChoice | null {
  return kind === "race" || kind === "hypertrophy" ? kind : null;
}
