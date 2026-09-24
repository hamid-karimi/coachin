type MealSlot = { meal_type: string; kcal: number };

export type MealAdherence = {
  /** Distinct meal_types in the plan for the day. */
  slotsPlanned: number;
  /** Planned meal_types that have at least one matching log that date. */
  slotsLogged: number;
  /** Sum of planned kcal. */
  kcalPlanned: number;
  /** Sum of ALL logged kcal (including unplanned types) — total-intake signal. */
  kcalLogged: number;
  /** kcalLogged / kcalPlanned, or null when nothing was planned. */
  kcalRatio: number | null;
};

/**
 * Deterministic meal adherence for a single date: how many planned meal-type
 * slots were filled, and logged kcal vs plan kcal. Slots match on meal_type
 * only (logs are foods, plan items are AI dish titles — they never string
 * match). Extra logged meal_types not in the plan are ignored for slots but
 * still count toward kcalLogged. No thresholds or verdicts — numbers only.
 */
export function mealAdherenceForDay(
  planned: MealSlot[],
  logged: MealSlot[],
): MealAdherence {
  const plannedTypes = new Set(planned.map((meal) => meal.meal_type));
  const loggedTypes = new Set(logged.map((meal) => meal.meal_type));

  let slotsLogged = 0;
  for (const type of plannedTypes) {
    if (loggedTypes.has(type)) slotsLogged += 1;
  }

  const kcalPlanned = planned.reduce((sum, meal) => sum + meal.kcal, 0);
  const kcalLogged = logged.reduce((sum, meal) => sum + meal.kcal, 0);

  return {
    slotsPlanned: plannedTypes.size,
    slotsLogged,
    kcalPlanned,
    kcalLogged,
    kcalRatio: kcalPlanned === 0 ? null : kcalLogged / kcalPlanned,
  };
}
