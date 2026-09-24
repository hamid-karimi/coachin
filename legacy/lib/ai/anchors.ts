/**
 * Fixed weekly commitments ("anchors" = the user's `schedules` rows) rendered
 * as prompt constraints for AI plan generation (weekly-commitments phase 4).
 * Prompt-level only — generators are asked to avoid the slots; nothing is
 * hard-scheduled. The agenda's collision chip remains the post-hoc guard.
 */
import { WEEK_DAYS, weekDayOf } from "@/lib/week-days";

export type PlanAnchor = {
  /** 0=Sunday..6=Saturday, matching `schedules.day_of_week`. */
  day_of_week: number;
  /** "HH:MM[:SS]" or null when the session has no set time. */
  time: string | null;
  /** Sport name, e.g. "Rock Climbing". */
  sport: string;
};

// Monday-first render order (matches how the app presents a training week).
const DAY_ORDER = new Map(WEEK_DAYS.map((day, index) => [day.id, index]));

/** "19:00:00" → "19:00"; shorter values pass through untouched. */
function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

/**
 * Constraints block appended to plan-generation prompts when the athlete has
 * fixed weekly commitments. Returns "" when there are none, so callers can
 * drop it with a `.filter(Boolean)`.
 */
export function anchorsPromptBlock(anchors: PlanAnchor[]): string {
  if (anchors.length === 0) return "";
  const slots = [...anchors]
    .sort(
      (a, b) =>
        (DAY_ORDER.get(a.day_of_week) ?? 7) -
        (DAY_ORDER.get(b.day_of_week) ?? 7),
    )
    .map((anchor) => {
      const day =
        weekDayOf(anchor.day_of_week)?.short ?? `day ${anchor.day_of_week}`;
      return [day, shortTime(anchor.time), anchor.sport]
        .filter(Boolean)
        .join(" ");
    })
    .join(", ");
  return (
    `The athlete has fixed weekly commitments that this plan must respect: [${slots}]. ` +
    `Do not schedule plan sessions that conflict with those slots. ` +
    `Treat them as training load: avoid scheduling HARD sessions (long runs, intervals, heavy strength) ` +
    `on the same day as an intense fixed commitment; prefer easy/recovery or rest on those days ` +
    `and place key sessions on free days.`
  );
}
