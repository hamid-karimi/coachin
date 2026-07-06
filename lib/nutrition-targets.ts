/**
 * Daily calorie + macro targets from body metrics and training load. Pure and
 * framework-free; the source of truth for this math is FORMULAS.md §10. The AI
 * meal-plan generator consumes these targets — it never computes them itself.
 */

export type NutritionGoal = "lose" | "maintain" | "gain" | "recomp";

export interface TargetInputs {
  sex: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  /** Distinct training days in a typical week (0–7). */
  trainingDaysPerWeek: number;
  goal: NutritionGoal;
}

export interface NutritionTargets {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Mifflin–St Jeor sex offset; unspecified sex uses the male/female midpoint. */
function sexOffset(sex: string | null): number {
  const value = (sex ?? "").toLowerCase();
  if (value.startsWith("m")) return 5;
  if (value.startsWith("f")) return -161;
  return -78;
}

/** Basal metabolic rate (Mifflin–St Jeor). */
function bmr(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string | null,
): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset(sex);
}

/** Activity multiplier from weekly training days. */
function activityFactor(trainingDaysPerWeek: number): number {
  const days = Math.max(0, Math.min(7, Math.round(trainingDaysPerWeek)));
  if (days === 0) return 1.2;
  if (days <= 2) return 1.375;
  if (days <= 4) return 1.55;
  if (days <= 6) return 1.725;
  return 1.9;
}

const GOAL_ADJUST: Record<NutritionGoal, number> = {
  lose: -0.18,
  maintain: 0,
  gain: 0.12,
  recomp: 0,
};

/** Protein grams per kg bodyweight by goal. */
const PROTEIN_PER_KG: Record<NutritionGoal, number> = {
  lose: 2.2,
  recomp: 2.2,
  maintain: 1.6,
  gain: 1.8,
};

const roundTo10 = (n: number) => Math.round(n / 10) * 10;

/** True when the essential body metrics for a target are present. */
export function canComputeTargets(input: TargetInputs): boolean {
  return (
    typeof input.age === "number" &&
    input.age > 0 &&
    typeof input.heightCm === "number" &&
    input.heightCm > 0 &&
    typeof input.weightKg === "number" &&
    input.weightKg > 0
  );
}

/**
 * Daily kcal + macro targets, or null when body metrics are missing. Calories
 * never drop below ~BMR (BMR × 1.1). Fat is fixed at 25% of calories, protein
 * scales with bodyweight per goal, and carbs take the remainder.
 */
export function computeTargets(input: TargetInputs): NutritionTargets | null {
  if (!canComputeTargets(input)) return null;
  const weightKg = input.weightKg as number;
  const heightCm = input.heightCm as number;
  const age = input.age as number;

  const base = bmr(weightKg, heightCm, age, input.sex);
  const tdee = base * activityFactor(input.trainingDaysPerWeek);
  const adjusted = tdee * (1 + GOAL_ADJUST[input.goal]);
  const kcal = roundTo10(Math.max(adjusted, base * 1.1));

  const protein_g = Math.round(weightKg * PROTEIN_PER_KG[input.goal]);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const remainder = Math.max(0, kcal - protein_g * 4 - fat_g * 9);
  const carbs_g = Math.round(remainder / 4);

  return { kcal, protein_g, carbs_g, fat_g };
}
