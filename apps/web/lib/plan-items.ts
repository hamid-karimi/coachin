import type { components } from "@/lib/api/schema";

export type PlanItemDetails = components["schemas"]["PlanItemDetailsBody"];

/** Compact stat line for a plan item, e.g. "6km · @ 7:45/km · 45min". */
export function planItemDetailLine(details?: PlanItemDetails | null): string {
  return [
    details?.distanceKm ? `${details.distanceKm}km` : null,
    details?.paceMinKm ? `@ ${details.paceMinKm}/km` : null,
    details?.durationMin ? `${details.durationMin}min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** YouTube "how-to" search URL for a plan item, or null when none is set. */
export function planItemVideoUrl(details?: PlanItemDetails | null): string | null {
  if (!details?.videoQuery) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(details.videoQuery)}`;
}

const TYPE_LABEL: Record<string, string> = {
  run: "Run",
  strength: "Strength",
  mobility: "Mobility",
  stretch: "Stretch",
  recovery: "Recovery",
  recovery_active: "Active recovery",
  meal_note: "Meal note",
};

/**
 * Human label for a plan item's `itemType`
 * (e.g. "recovery_active" → "Active recovery"). Unknown types fall back to a
 * de-underscored, capitalised version so this never renders a raw slug.
 */
export function planItemTypeLabel(type: string): string {
  const known = TYPE_LABEL[type];
  if (known) return known;

  const spaced = type.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "Session";
}

const RECOVERY_WALK = /walk|jog|hike|stroll|spin|swim|bike|cycle/i;

/**
 * The visual variant of an item: a recovery that is really a light walk or
 * spin reads as "recovery_active" (footsteps, not a bed).
 */
export function planItemVisualType(item: { itemType: string; title: string }): string {
  return item.itemType === "recovery" && RECOVERY_WALK.test(item.title) ? "recovery_active" : item.itemType;
}

/** Whether an item has a done toggle (meal notes don't). */
export function isCheckable(itemType: string): boolean {
  return itemType !== "meal_note";
}

/**
 * Whether an item dated `date` (YYYY-MM-DD) can be marked done on `today`
 * (YYYY-MM-DD): its day or the day after. The API enforces the same rule.
 */
export function logWindowOpen(date: string, today: string): boolean {
  const dayAfter = new Date(`${date}T00:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  return today >= date && today <= dayAfter.toISOString().slice(0, 10);
}
